import { BrowserContext } from 'playwright';
import { Client } from '@libsql/client';
import { urlId, scrapeRawAndStage } from '../utils';
import { saveRawJob } from '../db';

export async function scrapeOPS(db: Client, context: BrowserContext) {
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
        }).filter(r => r && r.title && !r.url.includes('javascript:')) as { id: string; title: string; url: string }[];
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

export async function scrapeGC(db: Client, context: BrowserContext) {
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
          const row = l.closest('li') || l.closest('tr') || l.parentElement;
          const rowText = row?.textContent?.toLowerCase() || '';
          if (rowText.includes('internal to the public service') || rowText.includes('public service only')) return null;
          if (!title || !href || title.length < 3) return null;
          return { title, url: href };
        }).filter(Boolean) as { id: string; title: string; url: string }[];
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

export async function scrapeWaterfront(db: Client, context: BrowserContext) {
  const sourceName = 'Waterfront Toronto';
  console.log(`Scraping ${sourceName}...`);
  const page = await context.newPage();
  try {
    await page.goto('https://www.waterfrontoronto.ca/opportunities/join-our-team', { waitUntil: 'networkidle' });
    const jobLinks = await page.$$eval('a', as => as
      .filter(a => a.innerText.toLowerCase().includes('view the job posting'))
      .map(a => ({ title: a.parentElement?.innerText.split('\n')[0] || 'Job Posting', url: (a as HTMLAnchorElement).href })));
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

export async function scrapeBarrie(db: Client, context: BrowserContext) {
  const sourceName = 'City of Barrie';
  const baseUrl = 'https://careers.barrie.ca';
  console.log(`Scraping ${sourceName}...`);
  const page = await context.newPage();
  try {
    await page.goto(`${baseUrl}/search/`, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(5000);

    let pageNum = 1;
    let hasNextPage = true;
    while (hasNextPage) {
      console.log(`[${sourceName}] Page ${pageNum}...`);
      await page.waitForSelector('a[href*="/careers/"]', { timeout: 15000 }).catch(() => {});

      const summaries = await page.evaluate((baseUrl) => {
        const seen = new Set<string>();
        return Array.from(document.querySelectorAll('a[href*="/careers/"]'))
          .map(l => {
            const href = (l as HTMLAnchorElement).getAttribute('href') || '';
            const url = href.startsWith('http') ? href : baseUrl + href;
            const title = l.textContent?.trim() || '';
            return { title, url };
          })
          .filter(j => {
            if (!j.title || j.title === 'Apply Now' || !j.url || seen.has(j.url)) return false;
            seen.add(j.url);
            return /\/careers\/.+-CA-\d+-en/.test(j.url);
          });
      }, baseUrl);

      let count = 0;
      for (const job of summaries) {
        count++;
        const idMatch = job.url.match(/CA-(\d+)-en/);
        const id = idMatch ? idMatch[1] : urlId(job.url);
        process.stdout.write(`\r[${sourceName}] ${count}/${summaries.length}`);
        await scrapeRawAndStage(db, context, { ...job, id }, sourceName);
      }
      console.log(`\n[${sourceName}] Finished page ${pageNum}.`);

      const nextBtn = await page.$('button:has-text("View next page"):not([disabled])');
      if (nextBtn && await nextBtn.isVisible()) {
        await nextBtn.click();
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

export async function scrapeCambridge(db: Client, context: BrowserContext) {
  const sourceName = 'City of Cambridge';
  console.log(`Scraping ${sourceName}...`);
  const page = await context.newPage();
  try {
    await page.goto('https://www.cambridge.ca/mayor-city-council-government/careers-volunteering/current-opportunities/', { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(3000);

    const summaries = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('table a[href*="sapsf.com/sfcareer/jobreqcareer"]'))
        .map(l => ({
          title: l.textContent?.trim() || '',
          url: (l as HTMLAnchorElement).href,
        }))
        .filter(j => j.title && j.url);
    });

    console.log(`[${sourceName}] Found ${summaries.length} jobs`);
    for (const job of summaries) {
      const id = new URL(job.url).searchParams.get('jobId') || urlId(job.url);
      await scrapeRawAndStage(db, context, { ...job, id }, sourceName);
    }
  } catch (err: any) {
    console.error(`Error scraping ${sourceName}: ${err.message}`);
  } finally {
    await page.close();
  }
}

export async function scrapeConservationHalton(db: Client, context: BrowserContext) {
  const sourceName = 'Conservation Halton';
  const pageUrl = 'https://www.conservationhalton.ca/about-us/employment/';
  console.log(`Scraping ${sourceName}...`);
  const page = await context.newPage();
  try {
    await page.goto(pageUrl, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(3000);

    const jobTitles = await page.evaluate(() =>
      Array.from(document.querySelectorAll('h2 button'))
        .map(btn => btn.textContent?.trim() || '')
        .filter(t => t.length > 3)
    );

    console.log(`[${sourceName}] Found ${jobTitles.length} jobs`);
    for (const title of jobTitles) {
      const btn = await page.$(`h2 button:has-text("${title.substring(0, 40)}")`);
      if (!btn) continue;

      await btn.click();
      await page.waitForTimeout(2000);

      const rawText = await page.evaluate((title) => {
        const buttons = Array.from(document.querySelectorAll('h2 button'));
        const btn = buttons.find(b => b.textContent?.trim().startsWith(title.substring(0, 20)));
        const h2 = btn?.closest('h2');
        const panel = h2?.nextElementSibling;
        if (!panel) return '';
        return `${title}\n\n${panel.textContent?.trim() || ''}`;
      }, title);

      if (rawText.length > 50) {
        const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').substring(0, 40);
        const url = `${pageUrl}#${slug}`;
        await saveRawJob(db, { id: urlId(url), url, source: sourceName, raw_text: rawText });
        process.stdout.write(' ✅');
      }
    }
    console.log(`\n[${sourceName}] Done.`);
  } catch (err: any) {
    console.error(`Error scraping ${sourceName}: ${err.message}`);
  } finally {
    await page.close();
  }
}

export async function scrapeDurhamRegion(db: Client, context: BrowserContext) {
  const sourceName = 'Durham Region';
  const baseUrl = 'https://recruitregion.durham.ca';
  const portalUrl = `${baseUrl}/psc/recruit_rmd/EMPLOYEE/HRMS/c/HRS_HRAM_FL.HRS_CG_SEARCH_FL.GBL?Page=HRS_APP_SCHJOB&Action=U&FOCUS=Applicant&SiteId=3`;
  console.log(`Scraping ${sourceName}...`);
  const page = await context.newPage();
  try {
    await page.goto(portalUrl, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(2000);

    await page.click('a:has-text("View All Jobs")');
    await page.waitForTimeout(3000);

    const summaries = await page.evaluate(() => {
      const results: Array<{ title: string; jobId: string; department: string; closingDate: string }> = [];
      const items = Array.from(document.querySelectorAll('[role="listitem"]')).filter(
        el => getComputedStyle(el as HTMLElement).cursor === 'pointer'
      );
      for (const item of items) {
        const divs = Array.from(item.querySelectorAll('div, span'));
        const getValue = (label: string) => {
          for (let i = 0; i < divs.length - 1; i++) {
            if (divs[i].textContent?.trim() === label) return divs[i + 1].textContent?.trim() || '';
          }
          return '';
        };
        const title = item.firstElementChild?.textContent?.trim() || '';
        const jobId = getValue('Job ID');
        if (title && jobId) results.push({ title, jobId, department: getValue('Business Unit'), closingDate: getValue('Close Date') });
      }
      return results;
    });

    console.log(`[${sourceName}] Found ${summaries.length} jobs`);
    if (!summaries.length) return;

    await page.click('[role="listitem"]');
    await page.waitForTimeout(2000);

    for (let i = 0; i < summaries.length; i++) {
      process.stdout.write(`\r[${sourceName}] ${i + 1}/${summaries.length}`);
      const { title, jobId, department, closingDate } = summaries[i];
      const url = `${baseUrl}/psc/recruit_rmd/EMPLOYEE/HRMS/c/HRS_HRAM_FL.HRS_CG_SEARCH_FL.GBL?JobOpeningId=${jobId}&SiteId=3`;

      const detail = await page.evaluate(() => {
        const main = document.querySelector('main');
        if (!main) return { location: '', employmentType: '', rawText: '' };
        const divs = Array.from(main.querySelectorAll('div, span'));
        const getValue = (label: string) => {
          for (let i = 0; i < divs.length - 1; i++) {
            if (divs[i].textContent?.trim() === label) return divs[i + 1].textContent?.trim() || '';
          }
          return '';
        };
        return { location: getValue('Location'), employmentType: getValue('Full/Part Time'), rawText: (main as HTMLElement).innerText?.trim() || '' };
      });

      const raw_text = `Title: ${title}\nDepartment: ${department}\nLocation: ${detail.location}\nClose Date: ${closingDate}\nEmployment Type: ${detail.employmentType}\n\n${detail.rawText}`;
      await saveRawJob(db, { id: urlId(url), url, source: sourceName, raw_text });

      if (i < summaries.length - 1) {
        const nextLink = page.locator('a:has-text("Next Job")');
        if (await nextLink.count() > 0) {
          await nextLink.click();
          await page.waitForTimeout(2000);
        }
      }
    }
    console.log(`\n[${sourceName}] Done.`);
  } catch (err: any) {
    console.error(`Error scraping ${sourceName}: ${err.message}`);
  } finally {
    await page.close();
  }
}

export async function scrapeBrantford(db: Client, context: BrowserContext) {
  const sourceName = 'City of Brantford';
  const base = 'https://www.brantford.ca';
  const subPages = [
    `${base}/your-government/careers/current-opportunities/full-time-opportunities/`,
    `${base}/your-government/careers/current-opportunities/part-time-opportunities/`,
    `${base}/your-government/careers/current-opportunities/seasonal-opportunities/`,
    `${base}/your-government/careers/current-opportunities/student-opportunities/`,
  ];
  console.log(`Scraping ${sourceName}...`);
  const seen = new Set<string>();
  const page = await context.newPage();
  try {
    for (const subUrl of subPages) {
      await page.goto(subUrl, { waitUntil: 'networkidle', timeout: 60000 });
      await page.waitForTimeout(2000);

      const jobs = await page.evaluate((base) => {
        return Array.from(document.querySelectorAll('table tbody tr')).map(row => {
          const link = row.querySelector('a[href*="job-profile"]') as HTMLAnchorElement;
          if (!link) return null;
          const cells = Array.from(row.querySelectorAll('td'));
          const href = link.getAttribute('href') || '';
          return {
            title: link.textContent?.trim() || '',
            url: href.startsWith('http') ? href : base + href,
            department: cells[1]?.textContent?.trim() || '',
            closingDate: cells[2]?.textContent?.trim() || '',
          };
        }).filter(Boolean);
      }, base);

      for (const job of jobs) {
        if (!job || seen.has(job.url)) continue;
        seen.add(job.url);
        await scrapeRawAndStage(db, context, { id: urlId(job.url), title: job.title, url: job.url, department: job.department, closingDate: job.closingDate }, sourceName);
      }
    }
    console.log(`\n[${sourceName}] Done.`);
  } catch (err: any) {
    console.error(`Error scraping ${sourceName}: ${err.message}`);
  } finally {
    await page.close();
  }
}
