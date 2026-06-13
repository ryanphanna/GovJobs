import { chromium, Browser, Page, BrowserContext } from 'playwright';
import { initDb, saveJob, cleanupExpiredJobs } from './db';
import { parseJobWithAI } from './ai_parser';

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

/**
 * Handles interstitial "Leaving GC Jobs" warning pages or similar redirects recursively.
 */
async function handleRedirections(page: Page, depth = 0): Promise<boolean> {
  if (depth > 3) return false; // Guard against infinite redirect loops

  const bodyText = await page.textContent('body');
  const isWarningPage = bodyText?.includes('leave the GC Jobs') || 
                        bodyText?.includes('quitter le site') ||
                        bodyText?.includes('Leaving an External Site') ||
                        page.url().includes('page2440'); // Common GC redirect code

  if (isWarningPage) {
    const externalLink = await page.$$eval('main a, #content a, .center-block a, .external-link a', as => {
      return as.filter(a => {
        const href = (a as HTMLAnchorElement).href;
        return href.startsWith('http') && 
               !href.includes('cfp-psc.gc.ca') && 
               !href.includes('#') && 
               !href.includes('mailto');
      }).map(a => (a as HTMLAnchorElement).href);
    });

    if (externalLink.length > 0 && externalLink[0]) {
      console.log(`   [Redirect Lvl ${depth + 1}] Following external link: ${externalLink[0]}`);
      await page.goto(externalLink[0], { waitUntil: 'networkidle', timeout: 60000 });
      await page.waitForTimeout(5000);
      
      // Recursively check if the new page is ALSO a redirect/warning page
      return await handleRedirections(page, depth + 1);
    }
  }
  return depth > 0; // Returns true if we performed at least one redirect
}

async function scrapeDetailsAndSave(context: BrowserContext, job: JobSummary, sourceName: string) {
  const page = await context.newPage();
  try {
    await page.goto(job.url, { waitUntil: 'networkidle', timeout: 45000 });
    await page.waitForTimeout(3000);
    
    // Check for "Leaving GC" or other interstitial pages
    await handleRedirections(page);

    // Wait for actual content to load (body is minimum, could wait for specific selectors)
    await page.waitForSelector('body', { timeout: 10000 });
    
    // Extract clean text for AI analysis
    const rawText = await page.evaluate(() => {
        const clone = document.body.cloneNode(true) as HTMLElement;
        // Strip navigational and metadata noise
        const noise = 'script, style, link, meta, noscript, .wb-share, #wb-dtmd, .socialMediaButtons, .page-options, nav, footer, header, #header, #footer';
        clone.querySelectorAll(noise).forEach(e => e.remove());
        return clone.innerText?.trim() || '';
    });

    if (!rawText || rawText.length < 100) {
        console.warn(`\n   ⚠️ Warning: Short content (${rawText.length} chars) for "${job.title}"`);
        return;
    }

    // AI Parsing via DeepSeek
    const aiResult = await parseJobWithAI(rawText);
    
    if (aiResult) {
        await saveJob(await initDb(), {
          id: job.id!,
          job_title: aiResult.job_title,
          department: aiResult.department,
          location: aiResult.location,
          salary_range: `${aiResult.salary_min || ''} - ${aiResult.salary_max || ''} (${aiResult.salary_period})`,
          description: aiResult.clean_description,
          closing_date: aiResult.closing_date || job.closingDate || '',
          url: job.url,
          source: sourceName,
          is_inventory: aiResult.is_inventory ? 1 : 0,
          is_student: aiResult.is_student ? 1 : 0,
          salary_min: aiResult.salary_min,
          salary_max: aiResult.salary_max,
          salary_period: aiResult.salary_period,
          work_model: aiResult.work_model,
          employment_type: aiResult.employment_type,
          duration: aiResult.duration,
          is_unionized: aiResult.is_unionized ? 1 : 0,
          union_name: aiResult.union_name,
          benefits: JSON.stringify(aiResult.benefits)
        });
        // Feedback loop for progress tracking
        process.stdout.write(` ✅`);
    } else {
        console.error(`\n   ❌ AI failed to parse: ${job.title}`);
    }
  } catch (err: any) {
    console.error(`\n   ⚠️ Error processing ${job.title}: ${err.message}`);
  } finally {
    await page.close();
  }
}

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

    const pageSizeSelect = await page.$('select[aria-label*="items per page"], select.joqReqPageSize, select[id*="pageSize"]');
    if (pageSizeSelect) {
        console.log(`[${sourceName}] Setting page size to 100...`);
        await pageSizeSelect.selectOption('100').catch(() => {});
        await page.waitForTimeout(7000);
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
          console.log(`[${sourceName}] Found ${jobRows.length} jobs on page ${pageNum}`);
          break;
        }
      }

      if (jobRows.length === 0) break;

      const summaries: JobSummary[] = [];
      for (const row of jobRows) {
        const titleLink = await row.$('.jobTitle-link, .jobTitle, a.job-link, a.job-title-link, a[role="link"], .job-list-item a, tr a, a');
        if (!titleLink) continue;

        const title = (await titleLink.textContent() || '').trim();
        const relativeUrl = await titleLink.getAttribute('href');
        
        if (!relativeUrl || relativeUrl === '#' || !title || title.toLowerCase().includes('candidate profile')) continue;
        
        const fullUrl = relativeUrl.startsWith('http') ? relativeUrl : baseUrl + relativeUrl;
        const urlObj = new URL(fullUrl, baseUrl);
        const id = urlObj.searchParams.get('career_job_req_id') || fullUrl.split('/').filter(Boolean).pop()?.split('?')[0] || Math.random().toString(36).substring(7);

        summaries.push({ id, title, url: fullUrl });
      }

      let count = 0;
      for (const job of summaries) {
        count++;
        process.stdout.write(`\r[${sourceName}] Detail ${count}/${summaries.length}: ${job.title.substring(0, 25)}...`);
        await scrapeDetailsAndSave(context, job, sourceName);
        await new Promise(r => setTimeout(r, 1000));
      }
      console.log(`\n[${sourceName}] Finished page ${pageNum}.`);

      const nextBtn = await page.$('a[title="Next Page"], a:has-text("Next"), button:has-text("Next"), [aria-label="Next"]');
      if (nextBtn) {
        const isDisabled = await nextBtn.getAttribute('class').then(c => c?.includes('disabled') || false) ||
                           await nextBtn.getAttribute('aria-disabled').then(a => a === 'true');
        
        if (await nextBtn.isVisible() && !isDisabled) {
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
    await page.goto('https://www.gojobs.gov.on.ca/Search.aspx', { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);

    const searchInput = await page.$('input[type="text"]');
    if (searchInput) await searchInput.type(' ', { delay: 100 });

    const btn = await page.$('#btnSearch');
    if (btn) {
      await btn.click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(5000);
    }

    let hasNextPage = true;
    let pageNum = 1;

    while (hasNextPage) {
        console.log(`[${sourceName}] Scraping page ${pageNum}...`);
        const summaries = await page.evaluate(() => {
          const table = document.querySelector('#dgSearchResults');
          if (!table) return [];
          const rows = Array.from(table.querySelectorAll('tr')).slice(1);
          return rows.map(row => {
            const titleLink = row.querySelector('a');
            if (!titleLink) return null;
            return { title: titleLink.textContent?.trim() || '', url: (titleLink as HTMLAnchorElement).href };
          }).filter(r => r && r.title && !r.url.includes('javascript:')) as JobSummary[];
        });

        let count = 0;
        for (const job of summaries) {
          count++;
          job.id = new URL(job.url).searchParams.get('JobID') || job.title;
          process.stdout.write(`\r[${sourceName}] Detail ${count}/${summaries.length}: ${job.title.substring(0, 25)}...`);
          await scrapeDetailsAndSave(context, job, sourceName);
          await new Promise(r => setTimeout(r, 1000));
        }
        console.log(`\n[${sourceName}] Finished page ${pageNum}.`);

        const nextLink = await page.$('#dgSearchResults tr:last-child a:has-text("Next")');
        if (nextLink) {
            await nextLink.click();
            await page.waitForLoadState('networkidle');
            await page.waitForTimeout(7000);
            pageNum++;
            if (pageNum > 10) break;
        } else {
            hasNextPage = false;
        }
    }
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
    await page.goto('https://emploisfp-psjobs.cfp-psc.gc.ca/psrs-srfp/applicant/page2440?fromMenu=true&toggleLanguage=en', { waitUntil: 'networkidle' });
    await page.waitForTimeout(5000);
    
    let hasNextPage = true;
    let pageNum = 1;

    while (hasNextPage) {
        console.log(`[${sourceName}] Scraping page ${pageNum}...`);
        const summaries = await page.evaluate(() => {
            const links = Array.from(document.querySelectorAll('a[href*="poster="]'));
            return links.map(l => {
                const title = l.textContent?.trim() || '';
                const href = (l as HTMLAnchorElement).href;
                if (!title || !href || title.length < 3) return null;
                return { title, url: href };
            }).filter(Boolean) as JobSummary[];
        });

        let count = 0;
        for (const job of summaries) {
          count++;
          const urlObj = new URL(job.url);
          job.id = urlObj.searchParams.get('poster') || job.title;
          process.stdout.write(`\r[${sourceName}] Detail ${count}/${summaries.length}: ${job.title.substring(0, 25)}...`);
          await scrapeDetailsAndSave(context, job, sourceName);
          await new Promise(r => setTimeout(r, 1000));
        }
        console.log(`\n[${sourceName}] Finished page ${pageNum}.`);

        const nextLink = await page.$(`a[href*="requestedPage=${pageNum + 1}"]`);
        if (nextLink) {
            await nextLink.click();
            await page.waitForLoadState('networkidle');
            await page.waitForTimeout(7000);
            pageNum++;
        } else {
            hasNextPage = false;
        }
    }
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

    const summaries = await page.$$eval('.job-tile, .job-card, li[role="listitem"]', (items) => {
        return items.map(item => {
            const link = item.querySelector('a');
            return link ? { title: link.textContent?.trim() || '', url: (link as HTMLAnchorElement).href } : null;
        }).filter(j => j && j.title && !j.url.includes('javascript:')) as JobSummary[];
    });

    console.log(`[${sourceName}] Found ${summaries.length} potential jobs`);
    for (const job of summaries) {
      const id = job.url.split('/').filter(Boolean).pop()?.split('?')[0] || job.title;
      await scrapeDetailsAndSave(context, { ...job, id }, sourceName);
      await new Promise(r => setTimeout(r, 1000));
    }
  } catch (err: any) {
    console.error(`Error scraping ${sourceName}: ${err.message}`);
  } finally {
    await page.close();
  }
}

async function main() {
  console.log('Launching browser (non-headless)...');
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext(BASE_CONFIG);

  console.log('--- STARTING SCRAPE RUN ---');
  
  await scrapeGC(context);
  await scrapeOPS(context);
  await scrapeOracleCloud(context, 'https://ehtc.fa.ca2.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1/jobs?mode=location', 'Metrolinx');
  await scrapeSuccessFactors(context, 'https://careers.halton.ca/search/', 'Halton Region', 'https://careers.halton.ca');

  console.log('Cleaning up expired jobs...');
  await cleanupExpiredJobs(await initDb());

  console.log('All scraping tasks complete.');
  await browser.close();
}

main().catch(console.error);
