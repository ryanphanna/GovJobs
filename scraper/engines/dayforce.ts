import { BrowserContext } from 'playwright';
import { Client } from '@libsql/client';
import { urlId, scrapeRawAndStage } from '../utils';

export async function scrapeDayforce(db: Client, context: BrowserContext, portalUrl: string, sourceName: string) {
  console.log(`Scraping ${sourceName} (Dayforce)...`);
  const page = await context.newPage();
  try {
    await page.goto(portalUrl, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(5000);

    const dismissBtn = await page.$('button:has-text("Reject"), button:has-text("Accept")');
    if (dismissBtn && await dismissBtn.isVisible()) {
      await dismissBtn.click();
      await page.waitForTimeout(1000);
    }

    let pageNum = 1;
    let hasNextPage = true;
    while (hasNextPage) {
      console.log(`[${sourceName}] Page ${pageNum}...`);
      await page.waitForSelector('a[href*="/jobs/"]', { timeout: 15000 }).catch(() => {});

      const summaries = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('a[href*="/jobs/"]'))
          .filter(l => /\/jobs\/\d+/.test((l as HTMLAnchorElement).href))
          .map(l => ({
            title: (l.querySelector('h2') || l).textContent?.trim() || '',
            url: (l as HTMLAnchorElement).href,
          }))
          .filter(j => j.title && j.url);
      });

      let count = 0;
      for (const job of summaries) {
        count++;
        const id = job.url.split('/').filter(Boolean).pop() || urlId(job.url);
        process.stdout.write(`\r[${sourceName}] ${count}/${summaries.length}`);
        await scrapeRawAndStage(db, context, { ...job, id }, sourceName);
      }
      console.log(`\n[${sourceName}] Finished page ${pageNum}.`);

      const paginationLabel = await page.$eval('ul[aria-label*="Page"]', el => el.getAttribute('aria-label') || '').catch(() => '');
      const match = paginationLabel.match(/Page (\d+) of (\d+)/);
      if (match && parseInt(match[1]) < parseInt(match[2])) {
        const nextEl = await page.$('[aria-label="Go to next page"]');
        if (nextEl && await nextEl.isVisible()) {
          await nextEl.click();
          await page.waitForTimeout(5000);
          pageNum++;
          if (pageNum > 20) break;
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
