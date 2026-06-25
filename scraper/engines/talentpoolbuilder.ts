import { BrowserContext } from 'playwright';
import { Client } from '@libsql/client';
import { urlId, scrapeRawAndStage } from '../utils';

export async function scrapeTalentPoolBuilder(db: Client, context: BrowserContext, portalUrl: string, sourceName: string) {
  console.log(`Scraping ${sourceName} (TalentPoolBuilder)...`);
  const page = await context.newPage();
  try {
    await page.goto(portalUrl, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(5000);

    const host = new URL(portalUrl).hostname;
    const summaries = await page.evaluate((host) => {
      return Array.from(document.querySelectorAll(`li a[href*="${host}"]`))
        .map(l => {
          const href = (l as HTMLAnchorElement).href;
          const title = l.firstChild?.textContent?.trim() || l.textContent?.trim() || '';
          return { title, url: href };
        })
        .filter(j => j.title && j.url && /\/\d+\//.test(j.url));
    }, host);

    console.log(`[${sourceName}] Found ${summaries.length} jobs`);
    for (const job of summaries) {
      const parts = new URL(job.url).pathname.split('/').filter(Boolean);
      const id = parts[parts.length - 1] || urlId(job.url);
      await scrapeRawAndStage(db, context, { ...job, id }, sourceName);
    }
  } catch (err: any) {
    console.error(`Error scraping ${sourceName}: ${err.message}`);
  } finally {
    await page.close();
  }
}
