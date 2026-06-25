import { BrowserContext } from 'playwright';
import { Client } from '@libsql/client';
import { urlId, scrapeRawAndStage } from '../utils';

export async function scrapeJobs2Web(db: Client, context: BrowserContext, portalUrl: string, sourceName: string) {
  const baseUrl = new URL(portalUrl).origin;
  console.log(`Scraping ${sourceName} (Jobs2Web)...`);
  const page = await context.newPage();
  try {
    let startRow = 0;
    let hasMore = true;
    while (hasMore) {
      const url = `${baseUrl}/search/?q=&sortColumn=referencedate&sortDirection=desc&startrow=${startRow}`;
      console.log(`[${sourceName}] startrow=${startRow}...`);
      await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
      await page.waitForTimeout(3000);
      await page.waitForSelector('table a[href*="/job/"]', { timeout: 15000 }).catch(() => {});

      const summaries = await page.evaluate((baseUrl) => {
        return Array.from(document.querySelectorAll('table a[href*="/job/"]'))
          .map(l => {
            const href = (l as HTMLAnchorElement).getAttribute('href') || '';
            return {
              title: l.textContent?.trim() || '',
              url: href.startsWith('http') ? href : baseUrl + href,
            };
          })
          .filter(j => j.title && j.url);
      }, baseUrl);

      if (summaries.length === 0) { hasMore = false; break; }

      let count = 0;
      for (const job of summaries) {
        count++;
        const id = new URL(job.url).pathname.split('/').filter(Boolean).pop() || urlId(job.url);
        process.stdout.write(`\r[${sourceName}] ${startRow + count}/?`);
        await scrapeRawAndStage(db, context, { ...job, id }, sourceName);
      }
      console.log(`\n[${sourceName}] Got ${summaries.length} jobs at startrow=${startRow}.`);

      const nextLink = await page.$(`a[href*="startrow=${startRow + 25}"]`);
      if (nextLink) {
        startRow += 25;
        if (startRow > 500) break;
      } else {
        hasMore = false;
      }
    }
  } catch (err: any) {
    console.error(`Error scraping ${sourceName}: ${err.message}`);
  } finally {
    await page.close();
  }
}
