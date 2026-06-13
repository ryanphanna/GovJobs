import { chromium, Page, BrowserContext } from 'playwright';
import { createHash } from 'crypto';
import { Database } from 'sqlite';
import { initDb, saveJob, cleanupExpiredJobs } from './db';
import { parseJobWithAI } from './ai_parser';

function urlId(url: string): string {
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
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36'
};

/**
 * Handles interstitial "Leaving GC Jobs" warning pages or similar redirects recursively.
 */
async function handleRedirections(page: Page, depth = 0): Promise<boolean> {
  if (depth > 3) return false;

  const bodyText = await page.textContent('body');
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
      console.log(`   [Redirect Lvl ${depth + 1}] Following external link: ${externalLink[0]}`);
      await page.goto(externalLink[0], { waitUntil: 'networkidle', timeout: 60000 });
      await page.waitForTimeout(5000);
      return await handleRedirections(page, depth + 1);
    }
  }
  return depth > 0;
}

async function scrapeDetailsAndSave(db: Database, context: BrowserContext, job: JobSummary, sourceName: string) {
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

    const aiResult = await parseJobWithAI(rawText);

    if (aiResult) {
        await saveJob(db, {
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
        process.stdout.write(` ✅`);
    } else {
        console.error(`\n   ❌ AI failed: ${job.title}`);
    }
  } catch (err: any) {
    console.warn(`   ⚠️  [${sourceName}] Failed ${job.url}: ${err.message}`);
  } finally {
    await page.close();
  }
}

async function scrapeSuccessFactors(db: Database, context: BrowserContext, url: string, sourceName: string, baseUrl: string) {
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
        await scrapeDetailsAndSave(db, context, { ...job, id }, sourceName);
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

async function scrapeOPS(db: Database, context: BrowserContext) {
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
          await scrapeDetailsAndSave(db, context, job, sourceName);
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

async function scrapeGC(db: Database, context: BrowserContext) {
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
          await scrapeDetailsAndSave(db, context, job, sourceName);
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

async function scrapeOracleCloud(db: Database, context: BrowserContext, url: string, sourceName: string) {
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
      const id = job.url.split('/').filter(Boolean).pop()?.split('?')[0] || urlId(job.url);
      await scrapeDetailsAndSave(db, context, { ...job, id }, sourceName);
      await new Promise(r => setTimeout(r, 1000));
    }
  } catch (err: any) {
    console.error(`Error scraping ${sourceName}: ${err.message}`);
  } finally {
    await page.close();
  }
}

async function scrapeWorkday(db: Database, context: BrowserContext, url: string, sourceName: string) {
  console.log(`Scraping ${sourceName} (Workday)...`);
  const page = await context.newPage();
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(10000);
    const summaries = await page.evaluate(() => {
        const links = Array.from(document.querySelectorAll('a[data-automation-id="jobTitle"], .css-19v9u64 a'));
        return links.map(l => ({ title: l.textContent?.trim() || '', url: (l as HTMLAnchorElement).href }))
                    .filter(j => j.title && j.url);
    });

    console.log(`[${sourceName}] Found ${summaries.length} jobs`);
    for (const job of summaries) {
      const id = job.url.split('/').filter(Boolean).pop() || urlId(job.url);
      await scrapeDetailsAndSave(db, context, { ...job, id }, sourceName);
    }
  } catch (err: any) {
    console.error(`Error scraping ${sourceName}: ${err.message}`);
  } finally {
    await page.close();
  }
}

async function scrapeNjoyn(db: Database, context: BrowserContext, url: string, sourceName: string) {
  console.log(`Scraping ${sourceName} (Njoyn)...`);
  const page = await context.newPage();
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(7000);
    const summaries = await page.evaluate(() => {
        const links = Array.from(document.querySelectorAll('a[href*="joblisting"], .job-title a, .njoyn-job-row a'));
        return links.map(l => ({ title: l.textContent?.trim() || '', url: (l as HTMLAnchorElement).href }))
                    .filter(j => j.title.length > 5 && j.url);
    });

    console.log(`[${sourceName}] Found ${summaries.length} jobs`);
    for (const job of summaries) {
      const id = new URL(job.url).searchParams.get('jobid') || job.url.split('/').filter(Boolean).pop() || urlId(job.url);
      await scrapeDetailsAndSave(db, context, { ...job, id }, sourceName);
    }
  } catch (err: any) {
    console.error(`Error scraping ${sourceName}: ${err.message}`);
  } finally {
    await page.close();
  }
}

async function scrapeHRSmart(db: Database, context: BrowserContext, url: string, sourceName: string) {
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
          await scrapeDetailsAndSave(db, context, { ...job, id }, sourceName);
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

async function scrapeICIMS(db: Database, context: BrowserContext, url: string, sourceName: string) {
  console.log(`Scraping ${sourceName} (iCIMS)...`);
  const page = await context.newPage();
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(10000);
    const frame = page.frame({ url: /icims\.com/ }) || page;
    const summaries = await frame.evaluate(() => {
        const links = Array.from(document.querySelectorAll('.iCIMS_JobsTable a[href*="job="]'));
        return links.map(l => ({ title: l.textContent?.trim() || '', url: (l as HTMLAnchorElement).href }))
                    .filter(j => j.title && j.url);
    });

    console.log(`[${sourceName}] Found ${summaries.length} jobs`);
    for (const job of summaries) {
      const id = new URL(job.url).searchParams.get('job') || urlId(job.url);
      await scrapeDetailsAndSave(db, context, { ...job, id }, sourceName);
    }
  } catch (err: any) {
    console.error(`Error scraping ${sourceName}: ${err.message}`);
  } finally {
    await page.close();
  }
}

async function scrapeWaterfront(db: Database, context: BrowserContext) {
  const sourceName = 'Waterfront Toronto';
  console.log(`Scraping ${sourceName}...`);
  const page = await context.newPage();
  try {
    await page.goto('https://www.waterfrontoronto.ca/opportunities/join-our-team', { waitUntil: 'networkidle' });
    const jobLinks = await page.$$eval('a', as => as.filter(a => a.innerText.toLowerCase().includes('view the job posting')).map(a => ({ title: a.parentElement?.innerText.split('\n')[0] || 'Job Posting', url: (a as HTMLAnchorElement).href })));
    for (const job of jobLinks) {
      if (!job.url.includes('waterfrontoronto.ca')) continue;
      await scrapeDetailsAndSave(db, context, { id: job.url.split('/').filter(Boolean).pop() || urlId(job.url), title: job.title, url: job.url }, sourceName);
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
  const context = await browser.newContext(BASE_CONFIG);
  const db = await initDb();

  console.log('--- STARTING SCRAPE RUN ---');

  // 1. Federal & Provincial
  await scrapeGC(db, context);
  await scrapeOPS(db, context);

  // 2. High Value Agencies
  await scrapeOracleCloud(db, context, 'https://ehtc.fa.ca2.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1/jobs?mode=location', 'Metrolinx');
  await scrapeSuccessFactors(db, context, 'https://careers.ttc.ca/search/', 'TTC', 'https://careers.ttc.ca');
  await scrapeSuccessFactors(db, context, 'https://jobs.toronto.ca/jobsatcity/', 'City of Toronto', 'https://jobs.toronto.ca');

  // 3. Regional GTHA
  await scrapeHRSmart(db, context, 'https://york.hua.hrsmart.com/hr/ats/JobSearch/viewAll', 'York Region');
  await scrapeICIMS(db, context, 'https://careers-peelregion.icims.com/jobs/search?ss=1', 'Peel Region');
  await scrapeSuccessFactors(db, context, 'https://careers.halton.ca/search/', 'Halton Region', 'https://careers.halton.ca');
  await scrapeSuccessFactors(db, context, 'https://jobs.mississauga.ca/search/', 'Mississauga', 'https://jobs.mississauga.ca');

  // 4. Municipalities (Workday/Njoyn)
  await scrapeWorkday(db, context, 'https://brampton.wd3.myworkdayjobs.com/Brampton_External_Careers', 'City of Brampton');
  await scrapeNjoyn(db, context, 'https://vaughan.njoyn.com/cl4/xweb/xweb.asp?tbtoken=ZlpRRhcXCB8GYwF0NyVccitLdGZfcVVMf0gjV1oMExdbW0UZXUcbBhdxcBEbURRTSXUuX30%3D&chk=ZVpaShM%3D&CLID=52423&page=joblisting', 'City of Vaughan');

  // 5. Specialized
  await scrapeWaterfront(db, context);

  console.log('\nCleaning up expired jobs...');
  await cleanupExpiredJobs(db);

  console.log('All scraping tasks complete.');
  await browser.close();
}

main().catch(console.error);
