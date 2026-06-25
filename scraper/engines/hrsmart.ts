import { BrowserContext } from 'playwright';
import { Client } from '@libsql/client';
import { urlId, scrapeRawAndStage } from '../utils';

export async function scrapeHRSmart(db: Client, context: BrowserContext, url: string, sourceName: string) {
  console.log(`Scraping ${sourceName} (HRSmart)...`);
  const page = await context.newPage();
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(7000);
    let hasNextPage = true;
    let pageNum = 1;
    while (hasNextPage) {
      console.log(`[${sourceName}] Page ${pageNum}...`);
      const summaries = await page.evaluate(() => {
        const links = Array.from(document.querySelectorAll('a[href*="/hr/ats/Posting/view/"]'));
        return links.map(l => ({ title: l.textContent?.trim() || '', url: (l as HTMLAnchorElement).href }))
                    .filter(j => j.title && !j.title.toLowerCase().includes('view details') && !j.title.match(/^\d+$/));
      });
      let count = 0;
      for (const job of summaries) {
        count++;
        const id = job.url.split('/').filter(Boolean).pop() || urlId(job.url);
        process.stdout.write(`\r[${sourceName}] ${count}/${summaries.length}`);
        await scrapeRawAndStage(db, context, { ...job, id }, sourceName);
      }
      console.log(`\n[${sourceName}] Finished page ${pageNum}.`);
      const nextBtn = await page.$('a.paginateNext, a:has-text("»"), a.next, a[rel="next"]');
      if (nextBtn) {
        const isDisabled = await nextBtn.evaluate(el => el.parentElement?.classList.contains('disabled'));
        if (!isDisabled) {
          await nextBtn.click();
          await page.waitForLoadState('networkidle');
          await page.waitForTimeout(5000);
          pageNum++;
        } else { hasNextPage = false; }
      } else { hasNextPage = false; }
    }
  } catch (err: any) {
    console.error(`Error scraping ${sourceName}: ${err.message}`);
  } finally {
    await page.close();
  }
}
