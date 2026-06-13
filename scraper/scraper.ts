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

    // --- TRICK: Set items per page to 100 ---
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
    await page.goto('https://www.gojobs.gov.on.ca/Search.aspx', { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);

    // --- TRICK: Type a space into keywords to trigger session events ---
    const searchInput = await page.$('input[type="text"]');
    if (searchInput) {
        await searchInput.type(' ', { delay: 100 });
    }

    const btn = await page.$('#btnSearch');
    if (btn) {
      console.log(`[${sourceName}] Clicking search button...`);
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
          const dataRows = rows.filter(r => r.querySelectorAll('td').length > 3);
          return dataRows.map(row => {
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

        console.log(`[${sourceName}] Found ${summaries.length} jobs on page ${pageNum}`);

        let count = 0;
        for (const job of summaries) {
          count++;
          job.id = new URL(job.url).searchParams.get('JobID') || job.title;
          process.stdout.write(`\r[${sourceName}] Scraping details: ${count}/${summaries.length} - ${job.title.substring(0, 30)}...`);
          await scrapeDetailsAndSave(context, job, sourceName);
          await new Promise(r => setTimeout(r, 1000));
        }
        console.log(`\n[${sourceName}] Finished page ${pageNum}.`);

        const nextLink = await page.$('#dgSearchResults tr:last-child a:has-text("Next")');
        if (nextLink) {
            console.log(`[${sourceName}] Clicking next page...`);
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
                const row = l.closest('li') || l.closest('tr') || l.parentElement;
                
                const text = row?.textContent || '';
                const closeMatch = text.match(/Closing date:\s*([\d-]+)/);
                const close = closeMatch ? closeMatch[1] : '';
                
                if (!title || !href || title.length < 3) return null;
                return { title, url: href, closingDate: close };
            }).filter(Boolean) as JobSummary[];
        });

        console.log(`[${sourceName}] Found ${summaries.length} jobs on page ${pageNum}`);

        let count = 0;
        for (const job of summaries) {
          count++;
          const urlObj = new URL(job.url);
          job.id = urlObj.searchParams.get('poster') || job.title;
          process.stdout.write(`\r[${sourceName}] Scraping details: ${count}/${summaries.length} - ${job.title.substring(0, 30)}...`);
          await scrapeDetailsAndSave(context, job, sourceName);
          await new Promise(r => setTimeout(r, 1000));
        }
        console.log(`\n[${sourceName}] Finished page ${pageNum}.`);

        const nextLink = await page.$(`a[href*="requestedPage=${pageNum + 1}"]`);
        if (nextLink) {
            console.log(`[${sourceName}] Clicking next page (${pageNum + 1})...`);
            await nextLink.click();
            await page.waitForLoadState('networkidle');
            await page.waitForTimeout(7000);
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

async function scrapeHRSmart(context: BrowserContext, url: string, sourceName: string) {
  console.log(`Scraping ${sourceName} (HRSmart)...`);
  const page = await context.newPage();
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(7000);

    let hasNextPage = true;
    let pageNum = 1;

    while (hasNextPage) {
        console.log(`[${sourceName}] Scraping page ${pageNum}...`);
        
        const summaries = await page.evaluate(() => {
            const links = Array.from(document.querySelectorAll('a[href*="/hr/ats/Posting/view/"]'));
            return links.map(l => {
                const title = l.textContent?.trim() || '';
                const href = (l as HTMLAnchorElement).href;
                if (!title || !href || title.toLowerCase().includes('view details') || title.match(/^\d+$/) || title.toLowerCase().includes('view all jobs') || title.includes('»') || title.includes('«')) return null;
                return { title, url: href };
            }).filter(Boolean) as { title: string, url: string }[];
        });

        console.log(`[${sourceName}] Found ${summaries.length} potential jobs on page ${pageNum}`);
        
        let count = 0;
        for (const job of summaries) {
          count++;
          const id = job.url.split('/').filter(Boolean).pop() || job.title;
          process.stdout.write(`\r[${sourceName}] Scraping details: ${count}/${summaries.length} - ${job.title.substring(0, 30)}...`);
          await scrapeDetailsAndSave(context, { ...job, id }, sourceName);
          await new Promise(r => setTimeout(r, 1000));
        }
        console.log(`\n[${sourceName}] Finished scraping page ${pageNum}.`);

        // Check for Next button (usually an a tag with text '»' or 'Next')
        const nextBtn = await page.$('a.paginateNext, a:has-text("»"), a.next, a[rel="next"]');
        if (nextBtn) {
            const isDisabled = await nextBtn.evaluate(el => el.parentElement?.classList.contains('disabled'));
            if (!isDisabled) {
                console.log(`[${sourceName}] Clicking next page...`);
                await nextBtn.click();
                await page.waitForLoadState('networkidle');
                await page.waitForTimeout(5000);
                pageNum++;
                if (pageNum > 10) break;
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

async function scrapeBambooHR(context: BrowserContext, url: string, sourceName: string) {
  console.log(`Scraping ${sourceName} (BambooHR)...`);
  const page = await context.newPage();
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(10000);

    const jobs = await page.$$eval('a', (as) => as
      .filter(a => (a as HTMLAnchorElement).href.includes('/jobs/view.php') || (a as HTMLAnchorElement).href.includes('/careers/'))
      .map(a => ({
        title: a.textContent?.trim() || '',
        url: (a as HTMLAnchorElement).href
      }))
    );

    const validJobs = jobs.filter(j => j.title.length > 3 && !j.title.toLowerCase().includes('view all'));
    console.log(`[${sourceName}] Found ${validJobs.length} potential jobs`);
    for (const job of validJobs) {
      console.log(`[${sourceName}] Found job: ${job.title}`);
      const id = new URL(job.url).searchParams.get('id') || job.url.split('/').filter(Boolean).pop() || job.title;
      await scrapeDetailsAndSave(context, { id, title: job.title, url: job.url }, sourceName);
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
    
    // Handle "Leaving the GC Jobs" warning page
    const bodyText = await page.textContent('body');
    if (bodyText?.includes('leave the GC Jobs') || bodyText?.includes('quitter le site')) {
        const externalLink = await page.$$eval('main a, #content a, .center-block a', as => {
             return as.filter(a => !(a as HTMLAnchorElement).href.includes('cfp-psc.gc.ca') && !(a as HTMLAnchorElement).href.includes('#') && !(a as HTMLAnchorElement).href.includes('mailto')).map(a => (a as HTMLAnchorElement).href);
        });
        if (externalLink.length > 0 && externalLink[0]) {
            await page.goto(externalLink[0] as string, { waitUntil: 'networkidle' });
            await page.waitForTimeout(3000);
        }
    }

    // Get clean text of the entire body to send to AI
    const rawText = await page.evaluate(() => {
        const clone = document.body.cloneNode(true) as HTMLElement;
        clone.querySelectorAll('script, style, link, meta, noscript, .wb-share, #wb-dtmd, .socialMediaButtons, .page-options, nav, footer, header').forEach(e => e.remove());
        return clone.innerText || '';
    });

    if (!rawText) return;

    // AI Parsing
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
    } else {
        console.error(`[${sourceName}] AI failed to parse: ${job.title}`);
    }
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

  // --- BETA RUN: Problematic Sources First ---
  console.log('--- STARTING BETA RUN ---');
  
  // 1. Federal (Multi-page + External Handling)
  await scrapeGC(context);
  
  // 2. Provincial (Multi-page)
  await scrapeOPS(context);
  
  // 3. Metrolinx (Oracle Cloud)
  await scrapeOracleCloud(context, 'https://ehtc.fa.ca2.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1/jobs?mode=location', 'Metrolinx');
  
  // 4. Regional GTHA (SuccessFactors/iCIMS)
  await scrapeHRSmart(context, 'https://york.hua.hrsmart.com/hr/ats/JobSearch/viewAll', 'York Region');
  await scrapeSuccessFactors(context, 'https://careers.halton.ca/search/', 'Halton Region', 'https://careers.halton.ca');
  await scrapeICIMS(context, 'https://careers-peelregion.icims.com/jobs/search?ss=1', 'Peel Region');

  // --- END OF BETA ---
  
  console.log('Cleaning up expired jobs...');
  await cleanupExpiredJobs(await initDb());

  console.log('All scraping tasks complete.');
  await browser.close();
}

main().catch(console.error);
