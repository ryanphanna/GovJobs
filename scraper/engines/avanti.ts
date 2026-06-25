import { BrowserContext } from 'playwright';
import { Client } from '@libsql/client';
import { urlId, scrapeRawAndStage } from '../utils';

export async function scrapeAvanti(db: Client, context: BrowserContext, portalUrl: string, sourceName: string) {
  const baseUrl = new URL(portalUrl).origin;
  console.log(`Scraping ${sourceName} (Avanti)...`);
  const page = await context.newPage();
  try {
    await page.goto(portalUrl, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(2000);

    const summaries = await page.evaluate((base) => {
      return Array.from(document.querySelectorAll('table tbody tr')).map(row => {
        const link = row.querySelector('a[href*="/careers/Job/Details/"]') as HTMLAnchorElement;
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
    }, baseUrl);

    console.log(`[${sourceName}] Found ${summaries.length} jobs`);
    for (const job of summaries) {
      if (!job) continue;
      await scrapeRawAndStage(db, context, { id: urlId(job.url), title: job.title, url: job.url, department: job.department, closingDate: job.closingDate }, sourceName);
    }
    console.log(`\n[${sourceName}] Done.`);
  } catch (err: any) {
    console.error(`Error scraping ${sourceName}: ${err.message}`);
  } finally {
    await page.close();
  }
}
