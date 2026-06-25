import { BrowserContext } from 'playwright';
import { Client } from '@libsql/client';
import { urlId } from '../utils';
import { saveRawJob } from '../db';

export async function scrapeADP(db: Client, context: BrowserContext, portalUrl: string, sourceName: string) {
  console.log(`Scraping ${sourceName} (ADP)...`);
  const page = await context.newPage();
  try {
    const loadPortal = async () => {
      await page.goto(portalUrl, { waitUntil: 'networkidle', timeout: 60000 });
      await page.waitForTimeout(5000);
    };

    await loadPortal();

    const count = await page.evaluate(() => {
      const heading = document.querySelector('h1');
      const match = heading?.textContent?.match(/\((\d+) of \d+\)/);
      return match ? parseInt(match[1]) : 0;
    });

    console.log(`[${sourceName}] Found ${count} jobs`);

    for (let i = 0; i < count; i++) {
      process.stdout.write(`\r[${sourceName}] ${i + 1}/${count}`);

      const clicked = await page.evaluate((idx) => {
        const candidates = Array.from(document.querySelectorAll('a[href="#"]'))
          .filter(a => !a.querySelector('img') && (a.textContent?.trim().length || 0) > 3);
        const link = candidates[idx] as HTMLElement;
        if (!link) return false;
        link.click();
        return true;
      }, i);

      if (!clicked) continue;

      await page.waitForTimeout(5000);

      const rawText = await page.evaluate(() => {
        const clone = document.body.cloneNode(true) as HTMLElement;
        clone.querySelectorAll('script, style, nav, footer').forEach(e => e.remove());
        return clone.innerText?.trim() || '';
      });

      const title = await page.evaluate(() => document.querySelector('h1, h2')?.textContent?.trim() || '');

      if (rawText.length > 100) {
        const id = urlId(portalUrl + i);
        await saveRawJob(db, { id, url: portalUrl, source: sourceName, raw_text: `${title}\n\n${rawText}` });
      }

      await loadPortal();
    }
    console.log(`\n[${sourceName}] Done.`);
  } catch (err: any) {
    console.error(`Error scraping ${sourceName}: ${err.message}`);
  } finally {
    await page.close();
  }
}
