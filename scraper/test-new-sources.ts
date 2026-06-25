import { chromium } from 'playwright';
import { initDb } from './db';
import { scrapeConservationHalton } from './engines/custom';
import { scrapeADP } from './engines/adp';

const ADP_CLARINGTON = 'https://workforcenow.adp.com/mascsr/default/mdf/recruitment/recruitment.html?cid=09ed440f-e109-4f6f-ac03-075ea0a3a5e5&ccId=19000101_000001&lang=en_CA';

async function main() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 800 }
  });
  const db = await initDb();

  await scrapeConservationHalton(db, context);
  await scrapeADP(db, context, ADP_CLARINGTON, 'Municipality of Clarington');

  await browser.close();
  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
