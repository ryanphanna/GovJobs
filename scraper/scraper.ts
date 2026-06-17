import { chromium, Page, BrowserContext } from 'playwright';
import { createHash } from 'crypto';
import { Client } from '@libsql/client';
import { initDb, saveRawJob, cleanupExpiredJobs } from './db';

export function urlId(url: string): string {
  return createHash('sha256').update(url).digest('hex').substring(0, 12);
}

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
  userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  viewport: { width: 1280, height: 800 }
};

/**
 * Handles interstitial "Leaving GC Jobs" warning pages or similar redirects recursively.
 */
async function handleRedirections(page: Page, depth = 0): Promise<boolean> {
  if (depth > 3) return false;

  const bodyText = await page.textContent('body');
  
  // Real login walls, not just bot warnings
  if (bodyText?.includes('Sign in with your GCKey') || bodyText?.includes('GCKey login')) {
    console.warn(`   ⚠️ [Login] Required for: ${page.url()}`);
    return false;
  }

  const isWarningPage = bodyText?.includes('leave the GC Jobs') || 
                        bodyText?.includes('quitter le site') ||
                        bodyText?.includes('Leaving an External Site') ||
                        page.url().includes('page2440');

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
      console.log(`   [Redirect Lvl ${depth + 1}] ${externalLink[0].substring(0, 50)}...`);
      await page.goto(externalLink[0], { waitUntil: 'networkidle', timeout: 60000 });
      await page.waitForTimeout(5000);
      return await handleRedirections(page, depth + 1);
    }
  }
  return depth > 0;
}

export async function scrapeRawAndStage(db: Client, context: BrowserContext, job: JobSummary, sourceName: string) {
  const page = await context.newPage();
  try {
    await page.goto(job.url, { waitUntil: 'networkidle', timeout: 45000 });
    await page.waitForTimeout(3000);

    await handleRedirections(page);
    await page.waitForSelector('body', { timeout: 10000 });

    const rawText = await page.evaluate(() => {
        const clone = document.body.cloneNode(true) as HTMLElement;
        const noise = 'script, style, link, meta, noscript, .wb-share, #wb-dtmd, .socialMediaButtons, .page-options, nav, footer, header, #header, #footer';
        clone.querySelectorAll(noise).forEach(e => e.remove());
        return clone.innerText?.trim() || '';
    });

    if (!rawText || rawText.length < 100) return;

    await saveRawJob(db, { id: job.id!, url: job.url, source: sourceName, raw_text: rawText });
    process.stdout.write(' ✅');
  } catch (err: any) {
    console.warn(`\n   ⚠️  [${sourceName}] Failed ${job.url}: ${err.message}`);
  } finally {
    await page.close();
  }
}

export async function scrapeSuccessFactors(db: Client, context: BrowserContext, url: string, sourceName: string, baseUrl: string) {
  console.log(`Scraping ${sourceName} (SuccessFactors)...`);
  const page = await context.newPage();
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(7000);

    const searchSelectors = ['button:has-text("Search Jobs")', 'button#search_btn', 'input[type="submit"]', '.search-button', 'button.primary', 'button:has-text("Search")'];
    for (const sel of searchSelectors) {
      const btn = await page.$(sel);
      if (btn && await btn.isVisible()) {
        await btn.click();
        await page.waitForTimeout(10000);
        break;
      }
    }

    const pageSizeSelect = await page.$('select[aria-label*="items per page"], select.joqReqPageSize, select[id*="pageSize"]');
    if (pageSizeSelect) {
        await pageSizeSelect.selectOption('100').catch(() => {});
        await page.waitForTimeout(7000);
    }

    let hasNextPage = true;
    let pageNum = 1;

    while (hasNextPage) {
      console.log(`[${sourceName}] Page ${pageNum}...`);
      await page.waitForSelector('.job-row, .jobResultItem, .job-list-item, [role="listitem"]', { timeout: 15000 }).catch(() => {});
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(2000);

      const summaries = await page.evaluate((baseUrl) => {
        const items = Array.from(document.querySelectorAll('.job-row, .jobResultItem, .job-list-item, tr.job-row, div[role="listitem"]'));
        return items.map(row => {
            const link = row.querySelector('.jobTitle-link, .jobTitle, a.job-link, a.job-title-link, a[role="link"], a') as HTMLAnchorElement;
            if (!link) return null;
            const title = link.textContent?.trim() || '';
            const href = link.href;
            if (!href || href === '#' || !title || title.toLowerCase().includes('candidate profile')) return null;
            const fullUrl = href.startsWith('http') ? href : baseUrl + href;
            return { title, url: fullUrl };
        }).filter(Boolean) as { title: string, url: string }[];
      }, baseUrl);

      if (summaries.length === 0) break;

      let count = 0;
      for (const job of summaries) {
        count++;
        const id = new URL(job.url).searchParams.get('career_job_req_id') || job.url.split('/').filter(Boolean).pop()?.split('?')[0] || urlId(job.url);
        process.stdout.write(`\r[${sourceName}] ${count}/${summaries.length}`);
        await scrapeRawAndStage(db, context, { ...job, id }, sourceName);
      }
      console.log(`\n[${sourceName}] Finished page ${pageNum}.`);

      const nextBtn = await page.$('a[title="Next Page"], a:has-text("Next"), button:has-text("Next"), .nextPageLink, li.next a, [aria-label="Next"]');
      if (nextBtn) {
        const isDisabled = await nextBtn.getAttribute('class').then(c => c?.includes('disabled') || c?.includes('inactive') || false) ||
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

async function scrapeOPS(db: Client, context: BrowserContext) {
  const sourceName = 'Province of Ontario';
  console.log(`Scraping ${sourceName} (OPS)...`);
  const page = await context.newPage();
  try {
    await page.goto('https://www.gojobs.gov.on.ca/Search.aspx', { waitUntil: 'networkidle' });
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
        console.log(`[${sourceName}] Page ${pageNum}...`);
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
          job.id = new URL(job.url).searchParams.get('JobID') || urlId(job.url);
          process.stdout.write(`\r[${sourceName}] ${count}/${summaries.length}`);
          await scrapeRawAndStage(db, context, job, sourceName);
        }
        console.log(`\n[${sourceName}] Finished page ${pageNum}.`);
        const nextLink = await page.$('#dgSearchResults tr:last-child a:has-text("Next")');
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

async function scrapeGC(db: Client, context: BrowserContext) {
  const sourceName = 'Government of Canada';
  console.log(`Scraping ${sourceName} (GC)...`);
  const page = await context.newPage();
  try {
    await page.goto('https://emploisfp-psjobs.cfp-psc.gc.ca/psrs-srfp/applicant/page2440?fromMenu=true&toggleLanguage=en', { waitUntil: 'networkidle' });
    await page.waitForTimeout(5000);
    let hasNextPage = true;
    let pageNum = 1;
    while (hasNextPage) {
        console.log(`[${sourceName}] Page ${pageNum}...`);
        const summaries = await page.evaluate(() => {
            const links = Array.from(document.querySelectorAll('a[href*="poster="]'));
            return links.map(l => {
                const title = l.textContent?.trim() || '';
                const href = (l as HTMLAnchorElement).href;
                
                // Get the closest row container to check for "Who can apply" info
                const row = l.closest('li') || l.closest('tr') || l.parentElement;
                const rowText = row?.textContent?.toLowerCase() || '';
                
                // Skip if explicitly internal or restricted to public service
                if (rowText.includes('internal to the public service') || 
                    rowText.includes('public service only')) {
                    return null;
                }

                if (!title || !href || title.length < 3) return null;
                return { title, url: href };
            }).filter(Boolean) as JobSummary[];
        });

        let count = 0;
        for (const job of summaries) {
          count++;
          const urlObj = new URL(job.url);
          job.id = urlObj.searchParams.get('poster') || urlId(job.url);
          process.stdout.write(`\r[${sourceName}] ${count}/${summaries.length}`);
          await scrapeRawAndStage(db, context, job, sourceName);
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

async function scrapeOracleCloud(db: Client, context: BrowserContext, url: string, sourceName: string) {
  console.log(`Scraping ${sourceName} (Oracle Cloud)...`);
  const page = await context.newPage();
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(15000);

    // Click "Show more" until it disappears
    let loadMore = true;
    while (loadMore) {
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(2000);
      const moreBtn = await page.$('button:has-text("Show more"), button:has-text("Load more"), a:has-text("Show more jobs")');
      if (moreBtn && await moreBtn.isVisible()) {
        await moreBtn.click();
        await page.waitForTimeout(5000);
      } else {
        loadMore = false;
      }
    }

    const summaries = await page.$$eval('.job-tile, .job-card, li[role="listitem"]', (items) => {
        return items.map(item => {
            const link = item.querySelector('a');
            return link ? { title: link.textContent?.trim() || '', url: (link as HTMLAnchorElement).href } : null;
        }).filter(j => j && j.title && !j.url.includes('javascript:')) as { title: string, url: string }[];
    });

    console.log(`[${sourceName}] Found ${summaries.length} jobs`);
    for (const job of summaries) {
      const id = job.url.split('/').filter(Boolean).pop()?.split('?')[0] || urlId(job.url);
      await scrapeRawAndStage(db, context, { ...job, id }, sourceName);
      await new Promise(r => setTimeout(r, 1000));
    }
  } catch (err: any) {
    console.error(`Error scraping ${sourceName}: ${err.message}`);
  } finally {
    await page.close();
  }
}

export async function scrapeWorkday(db: Client, context: BrowserContext, url: string, sourceName: string) {
  console.log(`Scraping ${sourceName} (Workday)...`);
  const page = await context.newPage();
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(10000);

    let loadMore = true;
    while (loadMore) {
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(2000);
      const loadMoreBtn = await page.$('button[data-automation-id="loadMoreButton"]');
      if (loadMoreBtn && await loadMoreBtn.isVisible()) {
        await loadMoreBtn.click();
        await page.waitForTimeout(5000);
      } else {
        loadMore = false;
      }
    }

    const summaries = await page.evaluate(() => {
        const links = Array.from(document.querySelectorAll('a[data-automation-id="jobTitle"]'));
        return links.map(l => ({ title: l.textContent?.trim() || '', url: (l as HTMLAnchorElement).href }))
                    .filter(j => j.title && j.url);
    });

    console.log(`[${sourceName}] Found ${summaries.length} jobs`);
    for (const job of summaries) {
      const id = job.url.split('/').filter(Boolean).pop() || urlId(job.url);
      await scrapeRawAndStage(db, context, { ...job, id }, sourceName);
    }
  } catch (err: any) {
    console.error(`Error scraping ${sourceName}: ${err.message}`);
  } finally {
    await page.close();
  }
}

async function scrapeNjoyn(db: Client, context: BrowserContext, url: string, sourceName: string) {
  console.log(`Scraping ${sourceName} (Njoyn)...`);
  const page = await context.newPage();
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(7000);

    let hasNextPage = true;
    let pageNum = 1;
    while (hasNextPage) {
      console.log(`[${sourceName}] Page ${pageNum}...`);
      const summaries = await page.evaluate(() => {
          const links = Array.from(document.querySelectorAll('a[href*="joblisting"], .job-title a, .njoyn-job-row a'));
          return links.map(l => ({ title: l.textContent?.trim() || '', url: (l as HTMLAnchorElement).href }))
                      .filter(j => j.title.length > 5 && j.url);
      });

      let count = 0;
      for (const job of summaries) {
        count++;
        const id = new URL(job.url).searchParams.get('jobid') || job.url.split('/').filter(Boolean).pop() || urlId(job.url);
        process.stdout.write(`\r[${sourceName}] ${count}/${summaries.length}`);
        await scrapeRawAndStage(db, context, { ...job, id }, sourceName);
      }
      console.log(`\n[${sourceName}] Finished page ${pageNum}.`);

      const nextBtn = await page.$('a:has-text("Next"), a.nextpage, a[rel="next"], td.next a');
      if (nextBtn && await nextBtn.isVisible()) {
        await nextBtn.click();
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(5000);
        pageNum++;
        if (pageNum > 20) break;
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

async function scrapePJB(db: Client, context: BrowserContext) {
  const sourceName = 'Partnership Job Board';
  console.log(`Scraping ${sourceName}...`);
  const page = await context.newPage();
  try {
    await page.goto('https://partnershipjobs.ca/postings/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(5000);
    const summaries = await page.evaluate(() => {
        const links = Array.from(document.querySelectorAll('a[href*="/job/"]'));
        return links.map(l => ({ title: l.textContent?.trim() || '', url: (l as HTMLAnchorElement).href }))
                    .filter(j => j.title.length > 5 && j.url && !j.url.includes('/postings/'));
    });

    console.log(`[${sourceName}] Found ${summaries.length} potential jobs`);
    for (const job of summaries) {
      const id = job.url.split('/').filter(Boolean).pop() || urlId(job.url);
      await scrapeRawAndStage(db, context, { ...job, id }, sourceName);
    }
  } catch (err: any) {
    console.error(`Error scraping ${sourceName}: ${err.message}`);
  } finally {
    await page.close();
  }
}

async function scrapeHRSmart(db: Client, context: BrowserContext, url: string, sourceName: string) {
  console.log(`Scraping ${sourceName} (HRSmart)...`);
  const page = await context.newPage();
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(7000);
    let hasNextPage = true;
    let pageNum = 1;
    while (hasNextPage) {
        console.log(`[${sourceName}] Page ${pageNum}...`);
        const summaries = await page.evaluate(() => {
            const links = Array.from(document.querySelectorAll('a[href*="/hr/ats/Posting/view/"]'));
            return links.map(l => ({ title: l.textContent?.trim() || '', url: (l as HTMLAnchorElement).href }))
                        .filter(j => j.title && !j.title.toLowerCase().includes('view details') && !j.title.match(/^\d+$/));
        });
        let count = 0;
        for (const job of summaries) {
          count++;
          const id = job.url.split('/').filter(Boolean).pop() || urlId(job.url);
          process.stdout.write(`\r[${sourceName}] ${count}/${summaries.length}`);
          await scrapeRawAndStage(db, context, { ...job, id }, sourceName);
        }
        console.log(`\n[${sourceName}] Finished page ${pageNum}.`);
        const nextBtn = await page.$('a.paginateNext, a:has-text("»"), a.next, a[rel="next"]');
        if (nextBtn) {
            const isDisabled = await nextBtn.evaluate(el => el.parentElement?.classList.contains('disabled'));
            if (!isDisabled) {
                await nextBtn.click();
                await page.waitForLoadState('networkidle');
                await page.waitForTimeout(5000);
                pageNum++;
            } else { hasNextPage = false; }
        } else { hasNextPage = false; }
    }
  } catch (err: any) {
    console.error(`Error scraping ${sourceName}: ${err.message}`);
  } finally {
    await page.close();
  }
}

async function scrapeICIMS(db: Client, context: BrowserContext, url: string, sourceName: string) {
  console.log(`Scraping ${sourceName} (iCIMS)...`);
  const page = await context.newPage();
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(10000);

    let hasNextPage = true;
    let pageNum = 1;
    while (hasNextPage) {
      console.log(`[${sourceName}] Page ${pageNum}...`);
      const frame = page.frame({ url: /icims\.com/ }) ?? page;
      const summaries = await frame.evaluate(() => {
          const links = Array.from(document.querySelectorAll('.iCIMS_JobsTable a[href*="job="]'));
          return links.map(l => ({ title: l.textContent?.trim() || '', url: (l as HTMLAnchorElement).href }))
                      .filter(j => j.title && j.url);
      });

      let count = 0;
      for (const job of summaries) {
        count++;
        const id = new URL(job.url).searchParams.get('job') || urlId(job.url);
        process.stdout.write(`\r[${sourceName}] ${count}/${summaries.length}`);
        await scrapeRawAndStage(db, context, { ...job, id }, sourceName);
      }
      console.log(`\n[${sourceName}] Finished page ${pageNum}.`);

      const nextBtn = await frame.$('a[title="Next Page"], a:has-text("Next"), .iCIMS_Pagination a:last-child');
      if (nextBtn && await nextBtn.isVisible()) {
        const isDisabled = await nextBtn.getAttribute('class').then(c => c?.includes('disabled') || false);
        if (!isDisabled) {
          await nextBtn.click();
          await page.waitForLoadState('networkidle');
          await page.waitForTimeout(7000);
          pageNum++;
          if (pageNum > 20) break;
        } else {
          hasNextPage = false;
        }
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

export async function scrapeWaterfront(db: Client, context: BrowserContext) {
  const sourceName = 'Waterfront Toronto';
  console.log(`Scraping ${sourceName}...`);
  const page = await context.newPage();
  try {
    await page.goto('https://www.waterfrontoronto.ca/opportunities/join-our-team', { waitUntil: 'networkidle' });
    const jobLinks = await page.$$eval('a', as => as.filter(a => a.innerText.toLowerCase().includes('view the job posting')).map(a => ({ title: a.parentElement?.innerText.split('\n')[0] || 'Job Posting', url: (a as HTMLAnchorElement).href })));
    for (const job of jobLinks) {
      if (!job.url.includes('waterfrontoronto.ca')) continue;
      await scrapeRawAndStage(db, context, { id: job.url.split('/').filter(Boolean).pop() || urlId(job.url), title: job.title, url: job.url }, sourceName);
    }
  } catch (err: any) {
    console.error(`Error scraping Waterfront: ${err.message}`);
  } finally {
    await page.close();
  }
}

async function main() {
  const runStartedAt = new Date().toISOString();
  console.log('Launching browser (non-headless)...');
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext(BASE_CONFIG);
  const db = await initDb();

  console.log('--- STARTING TORONTO SCRAPE RUN ---');

  // 1. Core Toronto Agencies
  await scrapeSuccessFactors(db, context, 'https://career17.sapsf.com/career?company=TTCPRODUCTION&career_ns=job_listing_summary&navBarLevel=JOB_SEARCH', 'TTC', 'https://career17.sapsf.com');
  await scrapeSuccessFactors(db, context, 'https://jobs.toronto.ca/jobsatcity/', 'City of Toronto', 'https://jobs.toronto.ca');
  await scrapeOracleCloud(db, context, 'https://ehtc.fa.ca2.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1/jobs?mode=location', 'Metrolinx');

  // 2. Libraries & Specialized
  await scrapeNjoyn(db, context, 'https://tpl.njoyn.com/CL/xweb/xweb.asp?page=joblisting&CLID=124455', 'Toronto Public Library');
  await scrapeWaterfront(db, context);

  /* 
  // Future Expansion (Non-Toronto specific)
  await scrapeGC(db, context);
  await scrapeOPS(db, context);
  await scrapeHRSmart(db, context, 'https://york.hua.hrsmart.com/hr/ats/JobSearch/viewAll', 'York Region');
  await scrapeICIMS(db, context, 'https://careers-peelregion.icims.com/jobs/search?ss=1', 'Peel Region');
  await scrapeSuccessFactors(db, context, 'https://careers.halton.ca/search/', 'Halton Region', 'https://careers.halton.ca');
  await scrapeSuccessFactors(db, context, 'https://jobs.mississauga.ca/search/', 'Mississauga', 'https://jobs.mississauga.ca');
  await scrapeWorkday(db, context, 'https://brampton.wd3.myworkdayjobs.com/Brampton_External_Careers', 'City of Brampton');
  await scrapeNjoyn(db, context, 'https://vaughan.njoyn.com/cl4/xweb/xweb.asp?tbtoken=ZlpRRhcXCB8GYwF0NyVccitLdGZfcVVMf0gjV1oMExdbW0UZXUcbBhdxcBEbURRTSXUuX30%3D&chk=ZVpaShM%3D&CLID=52423&page=joblisting', 'City of Vaughan');
  await scrapePJB(db, context);
  */

  console.log('\nCleaning up expired jobs...');
  await cleanupExpiredJobs(db, runStartedAt);

  console.log('All scraping tasks complete.');
  await browser.close();
}

if (require.main === module) {
  main().catch(console.error);
}
