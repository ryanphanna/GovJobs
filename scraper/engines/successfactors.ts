import { BrowserContext } from 'playwright';
import { Client } from '@libsql/client';
import { urlId, scrapeRawAndStage } from '../utils';

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
