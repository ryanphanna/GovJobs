import { chromium } from 'playwright';

async function debug() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto('https://jobs.toronto.ca/jobsatcity/search/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(5000);

  const firstRow = await page.$('.job-row');
  if (firstRow) {
    console.log('Row HTML:', await firstRow.innerHTML());
  }

  await browser.close();
}

debug();
