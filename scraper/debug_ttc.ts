import { chromium } from 'playwright';

async function debug() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  console.log('--- TTC SuccessFactors ---');
  await page.goto('https://career17.sapsf.com/career?company=TTCPRODUCTION', { waitUntil: 'networkidle' });
  await page.waitForTimeout(5000);
  
  const searchBtn = await page.$('button:has-text("Search Jobs")');
  if (searchBtn) {
    await searchBtn.click();
    await page.waitForTimeout(5000);
  }

  const firstRow = await page.$('.jobResultItem');
  if (firstRow) {
    console.log('Row HTML:', await firstRow.innerHTML());
  }

  await browser.close();
}

debug();
