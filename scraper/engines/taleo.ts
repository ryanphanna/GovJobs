import { BrowserContext } from 'playwright';
import { Client } from '@libsql/client';
import { urlId, scrapeRawAndStage } from '../utils';

export async function scrapeTaleo(db: Client, context: BrowserContext, searchUrl: string, sourceName: string) {
  console.log(`Scraping ${sourceName} (Taleo)...`);
  const page = await context.newPage();
  try {
    await page.goto(searchUrl, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(2000);

    const summaries = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('h4 a[href*="viewRequisition"]')).map(link => {
        const h4 = link.closest('h4');
        const dept = h4?.nextElementSibling?.textContent?.trim() || '';
        return { title: link.textContent?.trim() || '', url: (link as HTMLAnchorElement).href, department: dept };
      });
    });

    console.log(`[${sourceName}] Found ${summaries.length} jobs`);
    for (const job of summaries) {
      await scrapeRawAndStage(db, context, { id: urlId(job.url), ...job }, sourceName);
    }
    console.log(`\n[${sourceName}] Done.`);
  } catch (err: any) {
    console.error(`Error scraping ${sourceName}: ${err.message}`);
  } finally {
    await page.close();
  }
}
