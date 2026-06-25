import { BrowserContext } from 'playwright';
import { Client } from '@libsql/client';
import { urlId, scrapeRawAndStage } from '../utils';

export async function scrapeOracleCloud(db: Client, context: BrowserContext, url: string, sourceName: string) {
  console.log(`Scraping ${sourceName} (Oracle Cloud)...`);
  const page = await context.newPage();
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(15000);

    let loadMore = true;
    while (loadMore) {
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(2000);
      const moreBtn = await page.$('button:has-text("Show more"), button:has-text("Load more"), a:has-text("Show more jobs")');
      if (moreBtn && await moreBtn.isVisible()) {
        await moreBtn.click();
        await page.waitForTimeout(5000);
      } else {
        loadMore = false;
      }
    }

    const summaries = await page.$$eval('div.job-tile, .job-card, li[role="listitem"]', (items) => {
      return items.map(item => {
        const link = item.querySelector('a.job-list-item__link, a[href*="/job/"], a') as HTMLAnchorElement | null;
        if (!link || !link.href || link.href.includes('javascript:')) return null;
        const labelId = link.getAttribute('aria-labelledby');
        const titleEl = (labelId ? document.getElementById(labelId) : null)
          || item.querySelector('[class*="title"], h2, h3, h4')
          || item;
        const title = titleEl?.textContent?.trim().split('\n')[0].trim() || '';
        return title ? { title, url: link.href } : null;
      }).filter(j => j && j.title) as { title: string, url: string }[];
    });

    console.log(`[${sourceName}] Found ${summaries.length} jobs`);
    for (const job of summaries) {
      const id = job.url.split('/').filter(Boolean).pop()?.split('?')[0] || urlId(job.url);
      await scrapeRawAndStage(db, context, { ...job, id }, sourceName);
      await new Promise(r => setTimeout(r, 1000));
    }
  } catch (err: any) {
    console.error(`Error scraping ${sourceName}: ${err.message}`);
  } finally {
    await page.close();
  }
}
