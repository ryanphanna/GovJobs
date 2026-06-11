import { chromium } from 'playwright';

async function debug() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  console.log('--- Metrolinx ---');
  await page.goto('https://career17.sapsf.com/career?company=Metrolinx', { waitUntil: 'networkidle' });
  await page.waitForTimeout(5000);
  await page.screenshot({ path: 'metrolinx_init.png' });
  
  const searchBtn = await page.$('button:has-text("Search Jobs"), button#search_btn, .search-button');
  if (searchBtn) {
    console.log('Found search button, clicking...');
    await searchBtn.click();
    await page.waitForTimeout(10000);
    await page.screenshot({ path: 'metrolinx_after_click.png' });
  }

  const rows = await page.$$('.job-row, .jobResultItem');
  console.log('Metrolinx rows:', rows.length);

  await browser.close();
}

debug();
