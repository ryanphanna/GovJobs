import { BrowserContext } from 'playwright';
import { Client } from '@libsql/client';
import { urlId, scrapeRawAndStage } from '../utils';

export async function scrapeUltiPro(db: Client, context: BrowserContext, portalUrl: string, sourceName: string) {
  console.log(`Scraping ${sourceName} (UltiPro)...`);
  const baseUrl = new URL(portalUrl).origin;
  const page = await context.newPage();
  try {
    await page.goto(portalUrl, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(5000);
    await page.waitForSelector('a[href*="OpportunityDetail"]', { timeout: 15000 }).catch(() => {});

    let loadMore = true;
    while (loadMore) {
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(2000);
      const moreBtn = await page.$('button:has-text("Load more"), button:has-text("Show more")');
      if (moreBtn && await moreBtn.isVisible()) {
        await moreBtn.click();
        await page.waitForTimeout(4000);
      } else {
        loadMore = false;
      }
    }

    const summaries = await page.evaluate((baseUrl) => {
      return Array.from(document.querySelectorAll('a[href*="OpportunityDetail"]'))
        .map(l => {
          const href = (l as HTMLAnchorElement).getAttribute('href') || '';
          return {
            title: l.textContent?.trim() || '',
            url: href.startsWith('http') ? href : baseUrl + href,
          };
        })
        .filter(j => j.title && j.url);
    }, baseUrl);

    console.log(`[${sourceName}] Found ${summaries.length} jobs`);
    for (const job of summaries) {
      const id = new URL(job.url).searchParams.get('opportunityId') || urlId(job.url);
      await scrapeRawAndStage(db, context, { ...job, id }, sourceName);
    }
  } catch (err: any) {
    console.error(`Error scraping ${sourceName}: ${err.message}`);
  } finally {
    await page.close();
  }
}
