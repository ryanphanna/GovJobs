import { BrowserContext } from 'playwright';
import { Client } from '@libsql/client';
import { urlId, scrapeRawAndStage } from '../utils';

export async function scrapeICIMS(db: Client, context: BrowserContext, url: string, sourceName: string) {
  console.log(`Scraping ${sourceName} (iCIMS)...`);
  const page = await context.newPage();
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(10000);

    let hasNextPage = true;
    let pageNum = 1;
    while (hasNextPage) {
      console.log(`[${sourceName}] Page ${pageNum}...`);
      const frame = page.frame({ url: /icims\.com/ }) ?? page;
      const summaries = await frame.evaluate(() => {
        const links = Array.from(document.querySelectorAll('.iCIMS_JobsTable a[href*="job="]'));
        return links.map(l => ({ title: l.textContent?.trim() || '', url: (l as HTMLAnchorElement).href }))
                    .filter(j => j.title && j.url);
      });

      let count = 0;
      for (const job of summaries) {
        count++;
        const id = new URL(job.url).searchParams.get('job') || urlId(job.url);
        process.stdout.write(`\r[${sourceName}] ${count}/${summaries.length}`);
        await scrapeRawAndStage(db, context, { ...job, id }, sourceName);
      }
      console.log(`\n[${sourceName}] Finished page ${pageNum}.`);

      const nextBtn = await frame.$('a[title="Next Page"], a:has-text("Next"), .iCIMS_Pagination a:last-child');
      if (nextBtn && await nextBtn.isVisible()) {
        const isDisabled = await nextBtn.getAttribute('class').then(c => c?.includes('disabled') || false);
        if (!isDisabled) {
          await nextBtn.click();
          await page.waitForLoadState('networkidle');
          await page.waitForTimeout(7000);
          pageNum++;
          if (pageNum > 20) break;
        } else {
          hasNextPage = false;
        }
      } else {
        hasNextPage = false;
      }
    }
  } catch (err: any) {
    console.error(`Error scraping ${sourceName}: ${err.message}`);
  } finally {
    await page.close();
  }
}
