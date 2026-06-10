import { chromium, Browser, Page } from 'playwright';
import { initDb, saveJob, cleanupExpiredJobs } from './db.js';

interface JobSummary {
  id: string;
  title: string;
  url: string;
  department?: string;
  location?: string;
  closingDate?: string;
  salary?: string;
}

const BASE_CONFIG = {
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
};

async function scrapeSuccessFactors(page: Page, url: string, sourceName: string, baseUrl: string) {
  console.log(`Scraping ${sourceName} (SuccessFactors)...`);
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForTimeout(5000);

  // Check if we need to click "Search Jobs"
  const jobRowsInitial = await page.$$('.job-row, .jobResultItem');
  if (jobRowsInitial.length === 0) {
    const searchBtn = await page.$('button:has-text("Search Jobs"), button#search_btn, input[type="submit"]');
    if (searchBtn) {
      console.log('Clicking search button...');
      await searchBtn.click();
      await page.waitForTimeout(5000);
    }
  }

  const jobRows = await page.$$('.job-row, .jobResultItem');
  console.log(`Found ${jobRows.length} jobs for ${sourceName}`);

  const summaries: JobSummary[] = [];
  for (const row of jobRows) {
    // Pattern 1: City of Toronto (.jobTitle-link)
    // Pattern 2: TTC (.jobTitle)
    const titleLink = await row.$('.jobTitle-link, .jobTitle');
    if (!titleLink) continue;

    const title = (await titleLink.innerText()).trim();
    const relativeUrl = await titleLink.getAttribute('href');
    const fullUrl = relativeUrl ? (relativeUrl.startsWith('http') ? relativeUrl : baseUrl + relativeUrl) : '';
    
    // Extract ID
    const urlObj = new URL(fullUrl, baseUrl);
    const id = urlObj.searchParams.get('career_job_req_id') || fullUrl.split('/').filter(Boolean).pop() || Math.random().toString(36).substring(7);

    // Metadata extraction
    let department = '';
    let location = '';
    let postingDate = '';

    if (await row.$('.shifttype')) {
      department = await row.$eval('.shifttype div', el => (el as HTMLElement).innerText.trim()).catch(() => '');
      postingDate = await row.$eval('.date div', el => (el as HTMLElement).innerText.trim()).catch(() => '');
      location = await row.$eval('.location div', el => (el as HTMLElement).innerText.trim()).catch(() => '');
    } else if (await row.$('.noteSection')) {
      const noteText = await row.$eval('.noteSection', el => (el as HTMLElement).innerText.trim()).catch(() => '');
      // TTC Pattern: "Requisition ID: 13261 - Posted on 06/10/2026 - Accounting Services..."
      const parts = noteText.split(' - ');
      postingDate = parts.find(p => p.includes('Posted on'))?.replace('Posted on', '').trim() || '';
      department = parts.find(p => !p.includes('ID:') && !p.includes('Posted on'))?.trim() || '';
    }

    summaries.push({ id, title, url: fullUrl, department, location, closingDate: postingDate });
  }

  for (const job of summaries) {
    await scrapeDetailsAndSave(page, job, sourceName);
  }
}

async function scrapeDetailsAndSave(page: Page, job: JobSummary, sourceName: string) {
  console.log(`[${sourceName}] Scraping details: ${job.title}`);
  try {
    await page.goto(job.url, { waitUntil: 'networkidle' });
    const description = await page.$eval('.jobdescription, .joqReqDescription', el => (el as HTMLElement).innerText.trim()).catch(() => '');
    
    const department = await page.$eval('.job-department, .department', el => (el as HTMLElement).innerText.trim()).catch(() => job.department || '');
    const location = await page.$eval('.job-location, .location', el => (el as HTMLElement).innerText.trim()).catch(() => job.location || '');
    const salary = await page.$eval('.salary, .job-salary', el => (el as HTMLElement).innerText.trim()).catch(() => '');

    await saveJob(await initDb(), {
      id: job.id,
      job_title: job.title,
      department,
      location,
      salary_range: salary,
      description,
      closing_date: job.closingDate || '',
      url: job.url,
      source: sourceName
    });
    await page.waitForTimeout(1000);
  } catch (err) {
    console.error(`Error scraping details for ${job.title}:`, err);
  }
}

async function scrapeTTCInterns(page: Page) {
  const sourceName = 'TTC Internships';
  console.log(`Scraping ${sourceName}...`);
  await page.goto('https://www.ttc.ca/Jobs/Early-Talent/Early-Talent-Intern-Program/Intern-Opportunities', { waitUntil: 'networkidle' });
  
  const jobLinks = await page.$$eval('a', as => 
    as.filter(a => a.href.includes('jobId=') && a.innerText.length > 5)
      .map(a => ({ title: a.innerText.trim(), url: (a as HTMLAnchorElement).href }))
  );

  console.log(`Found ${jobLinks.length} internship positions`);

  for (const job of jobLinks) {
    const urlObj = new URL(job.url);
    const id = urlObj.searchParams.get('jobId') || job.title;
    await scrapeDetailsAndSave(page, { id, title: job.title, url: job.url }, sourceName);
  }
}

async function scrapeWaterfront(page: Page) {
  const sourceName = 'Waterfront Toronto';
  console.log(`Scraping ${sourceName}...`);
  await page.goto('https://www.waterfrontoronto.ca/opportunities/join-our-team', { waitUntil: 'networkidle' });
  
  const jobLinks = await page.$$eval('a', as => 
    as.filter(a => a.innerText.toLowerCase().includes('view the job posting'))
      .map(a => ({ title: a.parentElement?.innerText.split('\n')[0] || 'Job Posting', url: (a as HTMLAnchorElement).href }))
  );

  console.log(`Found ${jobLinks.length} jobs for Waterfront Toronto`);

  for (const job of jobLinks) {
    if (!job.url.includes('waterfrontoronto.ca')) continue;
    
    console.log(`[Waterfront] Scraping details: ${job.title}`);
    try {
      await page.goto(job.url, { waitUntil: 'networkidle' });
      const description = await page.$eval('.field-name-body, .content', el => (el as HTMLElement).innerText.trim()).catch(() => '');
      const id = job.url.split('/').filter(Boolean).pop() || job.title;

      await saveJob(await initDb(), {
        id,
        job_title: job.title || 'Unknown Title',
        department: 'Waterfront',
        location: 'Toronto, ON',
        salary_range: '',
        description,
        closing_date: '',
        url: job.url,
        source: sourceName
      });
    } catch (err) {
      console.error(`Error scraping Waterfront job ${job.title}:`, err);
    }
  }
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext(BASE_CONFIG);
  const page = await context.newPage();

  // 1. City of Toronto
  await scrapeSuccessFactors(page, 'https://jobs.toronto.ca/jobsatcity/search/', 'City of Toronto', 'https://jobs.toronto.ca');

  // 2. TTC Main
  await scrapeSuccessFactors(page, 'https://career17.sapsf.com/career?company=TTCPRODUCTION', 'TTC', 'https://career17.sapsf.com');

  // 3. TTC Interns
  await scrapeTTCInterns(page);

  // 4. Waterfront
  await scrapeWaterfront(page);

  console.log('Cleaning up expired jobs...');
  await cleanupExpiredJobs(await initDb());

  console.log('All scraping tasks complete.');
  await browser.close();
}

main().catch(console.error);
