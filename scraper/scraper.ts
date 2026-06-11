import { chromium, Browser, Page, BrowserContext } from 'playwright';
import { initDb, saveJob, cleanupExpiredJobs } from './db';

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
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36'
};

async function scrapeSuccessFactors(context: BrowserContext, url: string, sourceName: string, baseUrl: string) {
  console.log(`Scraping ${sourceName} (SuccessFactors)...`);
  const page = await context.newPage();
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(7000);

    const searchSelectors = ['button:has-text("Search Jobs")', 'button#search_btn', 'input[type="submit"]', '.search-button', 'button.primary', 'button:has-text("Search")'];
    for (const sel of searchSelectors) {
      const btn = await page.$(sel);
      if (btn && await btn.isVisible()) {
        console.log(`[${sourceName}] Clicking search button (${sel})...`);
        await btn.click();
        await page.waitForTimeout(10000);
        break;
      }
    }

    let hasNextPage = true;
    let pageNum = 1;

    while (hasNextPage) {
      console.log(`[${sourceName}] Scraping page ${pageNum}...`);
      
      await page.waitForSelector('.job-row, .jobResultItem, .job-list-item, [role="listitem"]', { timeout: 15000 }).catch(() => {});
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(2000);

      const jobRowSelectors = ['.job-row', '.jobResultItem', '.job-list-item', 'tr.job-row', 'div[role="listitem"]'];
      let jobRows: any[] = [];
      for (const sel of jobRowSelectors) {
        jobRows = await page.$$(sel);
        if (jobRows.length > 0) {
          console.log(`[${sourceName}] Found ${jobRows.length} jobs on page ${pageNum} using ${sel}`);
          break;
        }
      }

      if (jobRows.length === 0) {
         console.log(`[${sourceName}] Found 0 jobs on page ${pageNum}.`);
         break;
      }

      const summaries: JobSummary[] = [];
      for (const row of jobRows) {
        const titleLink = await row.$('.jobTitle-link, .jobTitle, a.job-link, a.job-title-link, a[role="link"], .job-list-item a, tr a, a');
        if (!titleLink) continue;

        const title = (await titleLink.textContent() || '').trim();
        const relativeUrl = await titleLink.getAttribute('href');
        
        if (!relativeUrl || relativeUrl === '#' || !title || title.toLowerCase().includes('candidate profile') || title.toLowerCase().includes('sign in')) {
          continue;
        }
        
        const fullUrl = relativeUrl ? (relativeUrl.startsWith('http') ? relativeUrl : baseUrl + relativeUrl) : '';
        const urlObj = new URL(fullUrl, baseUrl);
        const id = urlObj.searchParams.get('career_job_req_id') || fullUrl.split('/').filter(Boolean).pop()?.split('?')[0] || Math.random().toString(36).substring(7);

        let department = '';
        let location = '';
        let postingDate = '';

        if (await row.$('.shifttype')) {
          department = await row.$eval('.shifttype div', (el: Element) => (el as HTMLElement).textContent?.trim() || '').catch(() => '');
          postingDate = await row.$eval('.date div', (el: Element) => (el as HTMLElement).textContent?.trim() || '').catch(() => '');
          location = await row.$eval('.location div', (el: Element) => (el as HTMLElement).textContent?.trim() || '').catch(() => '');

          const noteText = await row.$eval('.noteSection', (el: Element) => (el as HTMLElement).textContent?.trim() || '').catch(() => '');
          const parts = noteText.split('•').map((s: string) => s.trim());
          postingDate = parts.find((p: string) => p.includes('Posted on'))?.replace('Posted on', '').trim() || '';
          department = parts.find((p: string) => !p.includes('ID:') && !p.includes('Posted on'))?.trim() || '';
        }

        summaries.push({ id, title, url: fullUrl, department, location, closingDate: postingDate });
      }

      let count = 0;
      for (const job of summaries) {
        count++;
        process.stdout.write(`\r[${sourceName}] Scraping details: ${count}/${summaries.length} - ${job.title.substring(0, 30)}...`);
        await scrapeDetailsAndSave(context, job, sourceName);
        await new Promise(r => setTimeout(r, 1000));
      }
      console.log(`\n[${sourceName}] Finished scraping ${summaries.length} details.`);

      const nextBtn = await page.$('a[title="Next Page"], a:has-text("Next"), button:has-text("Next"), .nextPageLink, li.next a, [aria-label="Next"]');
      if (nextBtn) {
        const isDisabled = await nextBtn.getAttribute('class').then(c => c?.includes('disabled') || c?.includes('inactive') || false) ||
                           await nextBtn.getAttribute('aria-disabled').then(a => a === 'true');
        
        if (await nextBtn.isVisible() && !isDisabled) {
            console.log(`[${sourceName}] Clicking next page...`);
            await nextBtn.click();
            await page.waitForTimeout(10000);
            pageNum++;
            if (pageNum > 10) break;
            continue;
        }
      }
      hasNextPage = false;
    }
  } catch (err: any) {
    console.error(`Error scraping ${sourceName}: ${err.message}`);
  } finally {
    await page.close();
  }
}

async function scrapeOPS(context: BrowserContext) {
  const sourceName = 'Province of Ontario';
  console.log(`Scraping ${sourceName} (OPS)...`);
  const page = await context.newPage();
  try {
    // Start at a splash/search page to establish session
    await page.goto('https://www.gojobs.gov.on.ca/Search.aspx', { waitUntil: 'networkidle' });
    
    // Explicitly click search to trigger POST/session
    const btn = await page.$('#btnSearch');
    if (btn) {
      console.log(`[${sourceName}] Clicking primary search...`);
      await btn.click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(5000);
    }

    const summaries = await page.evaluate(() => {
      const table = document.querySelector('#dgSearchResults');
      if (!table) return [];
      const rows = Array.from(table.querySelectorAll('tr')).slice(1);
      return rows.map(row => {
        const titleLink = row.querySelector('a');
        if (!titleLink) return null;
        const title = titleLink.textContent?.trim() || '';
        const url = (titleLink as HTMLAnchorElement).href;
        const dept = row.querySelector('td:nth-child(2)')?.textContent?.trim() || '';
        const loc = row.querySelector('td:nth-child(3)')?.textContent?.trim() || '';
        const close = row.querySelector('td:nth-child(4)')?.textContent?.trim() || '';
        if (!title || !url || url.includes('javascript:')) return null;
        return { title, url, department: dept, location: loc, closingDate: close };
      }).filter(Boolean) as JobSummary[];
    });

    console.log(`[${sourceName}] Found ${summaries.length} potential jobs`);

    let count = 0;
    for (const job of summaries) {
      count++;
      job.id = new URL(job.url).searchParams.get('JobID') || job.title;
      process.stdout.write(`\r[${sourceName}] Scraping details: ${count}/${summaries.length} - ${job.title.substring(0, 30)}...`);
      await scrapeDetailsAndSave(context, job, sourceName);
      await new Promise(r => setTimeout(r, 1000));
    }
    console.log(`\n[${sourceName}] Finished scraping ${summaries.length} details.`);
  } catch (err: any) {
    console.error(`Error scraping ${sourceName}: ${err.message}`);
  } finally {
    await page.close();
  }
}

async function scrapeGC(context: BrowserContext) {
  const sourceName = 'Government of Canada';
  console.log(`Scraping ${sourceName} (GC)...`);
  const page = await context.newPage();
  try {
    // Federal jobs need specific navigation to stick the session
    await page.goto('https://emploisfp-psjobs.cfp-psc.gc.ca/psrs-srfp/rechercherSearch.do?action=search&lang=en', { waitUntil: 'networkidle' });
    
    // Attempt to click "Search jobs" to reveal full table
    const searchBtn = await page.$('input[value="Search jobs"], button:has-text("Search jobs"), input#btnSearch');
    if (searchBtn) {
        console.log(`[${sourceName}] Triggering search...`);
        await searchBtn.click();
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(7000);
    }

    const summaries = await page.evaluate(() => {
        const links = Array.from(document.querySelectorAll('a[href*="poster.htm"]'));
        return links.map(l => {
            const row = l.closest('tr');
            const title = l.textContent?.trim() || '';
            const href = (l as HTMLAnchorElement).href;
            const cells = Array.from(row?.querySelectorAll('td') || []);
            const dept = cells[1]?.textContent?.trim() || '';
            const loc = cells[2]?.textContent?.trim() || '';
            const close = cells[3]?.textContent?.trim() || '';
            if (!title || !href) return null;
            return { title, url: href, department: dept, location: loc, closingDate: close };
        }).filter(Boolean) as JobSummary[];
    });

    console.log(`[${sourceName}] Found ${summaries.length} potential jobs`);

    let count = 0;
    for (const job of summaries) {
      count++;
      const urlObj = new URL(job.url);
      job.id = urlObj.searchParams.get('jobRequisitionId') || urlObj.searchParams.get('poster') || job.title;
      process.stdout.write(`\r[${sourceName}] Scraping details: ${count}/${summaries.length} - ${job.title.substring(0, 30)}...`);
      await scrapeDetailsAndSave(context, job, sourceName);
      await new Promise(r => setTimeout(r, 1000));
    }
    console.log(`\n[${sourceName}] Finished scraping ${summaries.length} details.`);
  } catch (err: any) {
    console.error(`Error scraping ${sourceName}: ${err.message}`);
  } finally {
    await page.close();
  }
}

async function scrapeOracleCloud(context: BrowserContext, url: string, sourceName: string) {
  console.log(`Scraping ${sourceName} (Oracle Cloud)...`);
  const page = await context.newPage();
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(15000);

    const summaries = await page.evaluate(() => {
        const items = Array.from(document.querySelectorAll('.job-tile, .job-card, li[role="listitem"], .job-list-item, [class*="job-item"]'));
        return items.map(item => {
            const link = item.querySelector('a');
            if (!link) return null;
            const title = link.textContent?.trim() || '';
            const href = (link as HTMLAnchorElement).href;
            if (!title || !href || href.includes('javascript:')) return null;
            return { title, url: href };
        }).filter(Boolean) as { title: string, url: string }[];
    });

    console.log(`[${sourceName}] Found ${summaries.length} potential jobs`);

    for (const job of summaries) {
      const id = job.url.split('/').filter(Boolean).pop()?.split('?')[0] || job.title;
      await scrapeDetailsAndSave(context, { id, title: job.title, url: job.url }, sourceName);
      await new Promise(r => setTimeout(r, 1000));
    }
    
    if (summaries.length === 0) console.log(`[${sourceName}] No jobs parsed.`);
  } catch (err: any) {
    console.error(`Error scraping ${sourceName}: ${err.message}`);
  } finally {
    await page.close();
  }
}

async function scrapeWorkday(context: BrowserContext, url: string, sourceName: string) {
  console.log(`Scraping ${sourceName} (Workday)...`);
  const page = await context.newPage();
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(10000);

    const summaries = await page.evaluate(() => {
        const links = Array.from(document.querySelectorAll('a[data-automation-id="jobTitle"], .css-19v9u64 a'));
        return links.map(l => {
            const title = l.textContent?.trim() || '';
            const href = (l as HTMLAnchorElement).href;
            if (!title || !href) return null;
            return { title, url: href };
        }).filter(Boolean) as { title: string, url: string }[];
    });

    console.log(`[${sourceName}] Found ${summaries.length} potential jobs`);
    for (const job of summaries) {
      const id = job.url.split('/').filter(Boolean).pop() || job.title;
      await scrapeDetailsAndSave(context, { ...job, id }, sourceName);
      await new Promise(r => setTimeout(r, 1000));
    }
  } catch (err: any) {
    console.error(`Error scraping ${sourceName}: ${err.message}`);
  } finally {
    await page.close();
  }
}

async function scrapeNjoyn(context: BrowserContext, url: string, sourceName: string) {
  console.log(`Scraping ${sourceName} (Njoyn)...`);
  const page = await context.newPage();
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(7000);

    const summaries = await page.evaluate(() => {
        const links = Array.from(document.querySelectorAll('a[href*="joblisting"], .job-title a, .njoyn-job-row a'));
        return links.map(l => {
            const title = l.textContent?.trim() || '';
            const href = (l as HTMLAnchorElement).href;
            if (!title || !href || title.length < 5) return null;
            return { title, url: href };
        }).filter(Boolean) as { title: string, url: string }[];
    });

    console.log(`[${sourceName}] Found ${summaries.length} potential jobs`);
    for (const job of summaries) {
      const id = new URL(job.url).searchParams.get('jobid') || job.url.split('/').filter(Boolean).pop() || job.title;
      await scrapeDetailsAndSave(context, { ...job, id }, sourceName);
      await new Promise(r => setTimeout(r, 1000));
    }
  } catch (err: any) {
    console.error(`Error scraping ${sourceName}: ${err.message}`);
  } finally {
    await page.close();
  }
}

async function scrapeAvanti(context: BrowserContext, url: string, sourceName: string) {
  console.log(`Scraping ${sourceName} (Avanti)...`);
  const page = await context.newPage();
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(7000);

    const summaries = await page.evaluate(() => {
        const rows = Array.from(document.querySelectorAll('.job-listing, .job-item, .avanti-job-row, tr'));
        return rows.map(row => {
            const link = row.querySelector('a');
            if (!link) return null;
            const title = link.textContent?.trim() || '';
            const href = (link as HTMLAnchorElement).href;
            if (!title || !href || href.includes('javascript:')) return null;
            return { title, url: href };
        }).filter(Boolean) as JobSummary[];
    });

    console.log(`[${sourceName}] Found ${summaries.length} potential jobs`);
    for (const job of summaries) {
      const id = job.url.split('/').filter(Boolean).pop() || job.title;
      await scrapeDetailsAndSave(context, { ...job, id }, sourceName);
      await new Promise(r => setTimeout(r, 1000));
    }
  } catch (err: any) {
    console.error(`Error scraping ${sourceName}: ${err.message}`);
  } finally {
    await page.close();
  }
}

async function scrapeICIMS(context: BrowserContext, url: string, sourceName: string) {
  console.log(`Scraping ${sourceName} (iCIMS)...`);
  const page = await context.newPage();
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(10000);
    const frame = page.frame({ url: /icims\.com/ }) || page;
    const summaries = await frame.evaluate(() => {
        const links = Array.from(document.querySelectorAll('.iCIMS_JobsTable a[href*="job="]'));
        return links.map(l => {
            const row = l.closest('tr');
            const title = l.textContent?.trim() || '';
            const href = (l as HTMLAnchorElement).href;
            const dept = row?.querySelector('.iCIMS_JobHeaderField:nth-child(2)')?.textContent?.trim() || '';
            return { title, url: href, department: dept };
        }).filter(Boolean) as JobSummary[];
    });

    console.log(`[${sourceName}] Found ${summaries.length} potential jobs`);
    for (const job of summaries) {
      const id = new URL(job.url).searchParams.get('job') || job.title;
      await scrapeDetailsAndSave(context, { ...job, id }, sourceName);
      await new Promise(r => setTimeout(r, 1000));
    }
  } catch (err: any) {
    console.error(`Error scraping ${sourceName}: ${err.message}`);
  } finally {
    await page.close();
  }
}

async function scrapeTaleo(context: BrowserContext, url: string, sourceName: string) {
  console.log(`Scraping ${sourceName} (Taleo)...`);
  const page = await context.newPage();
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(10000);

    const jobs = await page.$$eval('a', (as) => as
      .filter(a => ((a as HTMLAnchorElement).href.includes('jobId=') || (a as HTMLAnchorElement).href.includes('rid=')) && a.textContent?.trim().length! > 5)
      .map(a => ({
        title: a.textContent?.trim() || '',
        url: (a as HTMLAnchorElement).href
      }))
    );

    const junk = ['view', 'apply', 'details', 'back to search'];
    const validJobs = jobs.filter(j => !junk.includes(j.title.toLowerCase()));

    console.log(`[${sourceName}] Found ${validJobs.length} potential jobs`);
    for (const job of validJobs) {
      const id = new URL(job.url).searchParams.get('jobId') || new URL(job.url).searchParams.get('rid') || job.url.split('/').filter(Boolean).pop() || job.title;
      await scrapeDetailsAndSave(context, { id, title: job.title, url: job.url }, sourceName);
      await new Promise(r => setTimeout(r, 1000));
    }
  } catch (err: any) {
    console.error(`Error scraping ${sourceName}: ${err.message}`);
  } finally {
    await page.close();
  }
}

async function scrapeDetailsAndSave(context: BrowserContext, job: JobSummary, sourceName: string) {
  const page = await context.newPage();
  try {
    await page.goto(job.url, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(3000);
    
    const descSelectors = [
      '.jobdescription', '.joqReqDescription', '.description', 
      '#job-details', '.job-info', '.job-content', '.field-name-body', 
      '.BambooHR-ATS-Job-Details', '[class*="JobRequisitionDetails"]',
      '.job-details', '.job-detail', '.description-content', '.job-posting',
      '#ops-job-details', '.ops-description', '#gc-job-poster', '.avanti-job-details',
      '.iCIMS_JobDescription', '#workday-job-description', '.job-description'
    ];
    let description = '';
    for (const sel of descSelectors) {
      description = await page.$eval(sel, (el: Element) => {
          const clone = el.cloneNode(true) as HTMLElement;
          // Remove scripts, styles, and other metadata junk
          clone.querySelectorAll('script, style, link, meta, noscript').forEach(e => e.remove());
          return clone.innerHTML?.trim() || '';
      }).catch(() => '');
      if (description) break;
    }
    
    if (!description) {
      description = await page.$eval('main, #content, .content, article, #job-content, #wb-main', (el: Element) => {
          const clone = el.cloneNode(true) as HTMLElement;
          clone.querySelectorAll('script, style, link, meta, noscript').forEach(e => e.remove());
          return clone.innerHTML?.trim() || '';
      }).catch(() => '');
    }

    const department = await page.$eval('.job-department, .department, [class*="department"]', (el: Element) => (el as HTMLElement).textContent?.trim() || '').catch(() => job.department || '');
    const location = await page.$eval('.job-location, .location, [class*="location"]', (el: Element) => (el as HTMLElement).textContent?.trim() || '').catch(() => job.location || '');
    const salary = await page.$eval('.salary, .job-salary, .salary-range', (el: Element) => (el as HTMLElement).textContent?.trim() || '').catch(() => '');

    await saveJob(await initDb(), {
      id: job.id!,
      job_title: job.title,
      department,
      location,
      salary_range: salary,
      description: description || 'No description found.',
      closing_date: job.closingDate || '',
      url: job.url,
      source: sourceName
    });
  } catch (err: any) {
    // silent fail
  } finally {
    await page.close();
  }
}

async function scrapeTTCInterns(context: BrowserContext) {
  const sourceName = 'TTC Internships';
  console.log(`Scraping ${sourceName}...`);
  const page = await context.newPage();
  try {
    await page.goto('https://www.ttc.ca/Jobs/Early-Talent/Early-Talent-Program/Intern-Opportunities', { waitUntil: 'networkidle', timeout: 30000 });
    const jobLinks = await page.$$eval('a', as => as.filter(a => a.href.includes('jobId=') && a.innerText.length > 5).map(a => ({ title: a.innerText.trim(), url: (a as HTMLAnchorElement).href })));
    for (const job of jobLinks) {
      const urlObj = new URL(job.url);
      const id = urlObj.searchParams.get('jobId') || job.title;
      await scrapeDetailsAndSave(context, { id, title: job.title, url: job.url }, sourceName);
      await new Promise(r => setTimeout(r, 1000));
    }
  } catch (err: any) {
    console.error(`Error scraping ${sourceName}: ${err.message}`);
  } finally {
    await page.close();
  }
}

async function scrapeWaterfront(context: BrowserContext) {
  const sourceName = 'Waterfront Toronto';
  console.log(`Scraping ${sourceName}...`);
  const page = await context.newPage();
  try {
    await page.goto('https://www.waterfrontoronto.ca/opportunities/join-our-team', { waitUntil: 'networkidle' });
    const jobLinks = await page.$$eval('a', as => as.filter(a => a.innerText.toLowerCase().includes('view the job posting')).map(a => ({ title: a.parentElement?.innerText.split('\n')[0] || 'Job Posting', url: (a as HTMLAnchorElement).href })));
    for (const job of jobLinks) {
      if (!job.url.includes('waterfrontoronto.ca')) continue;
      try {
        await scrapeDetailsAndSave(context, { id: job.url.split('/').filter(Boolean).pop() || job.title, title: job.title, url: job.url }, sourceName);
        await new Promise(r => setTimeout(r, 1000));
      } catch (err) {
        console.error(`Error scraping Waterfront job ${job.title}:`, err);
      }
    }
  } catch (err: any) {
    console.error(`Error scraping Waterfront: ${err.message}`);
  } finally {
    await page.close();
  }
}

async function main() {
  console.log('Launching browser (non-headless)...');
  const browser = await chromium.launch({ headless: false });
  console.log('Creating browser context...');
  const context = await browser.newContext(BASE_CONFIG);

  // 1. Federal & Provincial
  await scrapeGC(context);
  await scrapeOPS(context);

  // 2. Regional GTHA
  await scrapeSuccessFactors(context, 'https://career4.successfactors.com/career?company=yorkregion', 'York Region', 'https://career4.successfactors.com');
  await scrapeSuccessFactors(context, 'https://careers.halton.ca/search/', 'Halton Region', 'https://careers.halton.ca');
  await scrapeICIMS(context, 'https://careers-peelregion.icims.com/jobs/search?ss=1', 'Peel Region');
  
  // 3. Core Cities
  await scrapeSuccessFactors(context, 'https://jobs.toronto.ca/jobsatcity/search/', 'City of Toronto', 'https://jobs.toronto.ca');
  await scrapeSuccessFactors(context, 'https://career17.sapsf.com/career?company=TTCPRODUCTION', 'TTC', 'https://career17.sapsf.com');
  await scrapeTTCInterns(context);
  await scrapeOracleCloud(context, 'https://ehtc.fa.ca2.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1/jobs?mode=location', 'Metrolinx');
  await scrapeBambooHR(context, 'https://cityofhamilton.bamboohr.com/careers', 'City of Hamilton');
  await scrapeSuccessFactors(context, 'https://career17.sapsf.com/career?company=cityofmiss', 'City of Mississauga', 'https://career17.sapsf.com');
  
  // 4. Expanded Cities
  await scrapeWorkday(context, 'https://brampton.wd3.myworkdayjobs.com/CityofBramptonCareers', 'City of Brampton');
  await scrapeNjoyn(context, 'https://vaughan.njoyn.com/CL4/xweb/xweb.asp?tbtoken=Z19dRBYXCBp2Y3FzR1ZfCFU%2Bdm9daVdcB0gjU1p%2FE2ZfL0YfX0YbeR9wcBAbExZTSXdhX3Y%3D&chk=ZVpaShM%3D&page=joblisting', 'City of Vaughan');
  await scrapeSuccessFactors(context, 'https://career17.sapsf.com/career?company=cityofmark', 'City of Markham', 'https://career17.sapsf.com');
  await scrapeNjoyn(context, 'https://oshawa.njoyn.com/', 'City of Oshawa');
  await scrapeWorkday(context, 'https://townofajax.myworkdayjobs.com/AjaxCareers', 'Town of Ajax');
  await scrapeICIMS(context, 'https://guelph.icims.com/jobs/search?ss=1', 'City of Guelph');
  await scrapeOracleCloud(context, 'https://eeid.fa.ca2.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1', 'City of Richmond Hill');
  await scrapeAvanti(context, 'https://whitby.avanti-atms.com/ExternalCareerSite/', 'Town of Whitby');
  await scrapeAvanti(context, 'https://milton.avanti-atms.com/ExternalCareerSite/', 'Town of Milton');
  await scrapeTaleo(context, 'https://tre.tbe.taleo.net/tre01/ats/careers/v2/searchResults?org=TOWNOFOA&cws=43', 'Town of Oakville');
  await scrapeWaterfront(context);

  console.log('Cleaning up expired jobs...');
  await cleanupExpiredJobs(await initDb());

  console.log('All scraping tasks complete.');
  await browser.close();
}

main().catch(console.error);
