import { BrowserContext } from 'playwright';
import { Client } from '@libsql/client';
import { urlId, scrapeRawAndStage } from '../utils';

export async function scrapeBambooHR(db: Client, context: BrowserContext, portalUrl: string, sourceName: string) {
  const baseUrl = new URL(portalUrl).origin;
  console.log(`Scraping ${sourceName} (BambooHR)...`);
  const page = await context.newPage();
  try {
    await page.goto(portalUrl, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(3000);

    const summaries = await page.evaluate((base) => {
      return Array.from(document.querySelectorAll('a[href*="/careers/"]'))
        .filter(l => /\/careers\/\d+/.test((l as HTMLAnchorElement).href || l.getAttribute('href') || ''))
        .map(l => {
          const href = (l as HTMLAnchorElement).href || l.getAttribute('href') || '';
          const url = href.startsWith('http') ? href : base + href;
          return { title: l.textContent?.trim() || '', url };
        })
        .filter(j => j.title && j.url);
    }, baseUrl);

    console.log(`[${sourceName}] Found ${summaries.length} jobs`);
    for (const job of summaries) {
      const id = job.url.split('/').filter(Boolean).pop() || urlId(job.url);
      await scrapeRawAndStage(db, context, { ...job, id }, sourceName);
    }
    console.log(`\n[${sourceName}] Done.`);
  } catch (err: any) {
    console.error(`Error scraping ${sourceName}: ${err.message}`);
  } finally {
    await page.close();
  }
}

// CreateTO embeds a BambooHR widget on their own site rather than hosting on bamboohr.com directly.
export async function scrapeCreateTO(db: Client, context: BrowserContext) {
  const sourceName = 'CreateTO';
  console.log(`Scraping ${sourceName}...`);
  const page = await context.newPage();
  try {
    await page.goto('https://createto.ca/about-us/careers', { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(3000);

    const summaries = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('a[href*="bamboohr.com/careers/"]'))
        .map(l => ({
          title: l.textContent?.trim() || '',
          url: (l as HTMLAnchorElement).href,
        }))
        .filter(j => j.title && j.url && /\/careers\/\d+/.test(j.url));
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
