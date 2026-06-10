import { chromium } from 'playwright';

async function debug() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  console.log('--- TTC SuccessFactors ---');
  // Try to find the actual search results
  await page.goto('https://career17.sapsf.com/career?company=TTCPRODUCTION', { waitUntil: 'networkidle' });
  await page.waitForTimeout(5000);
  
  // Look for any search button and click it if it exists to load results
  const searchBtn = await page.$('button#search_btn, input[type="submit"]');
  if (searchBtn) {
    console.log('Found search button, clicking...');
    await searchBtn.click();
    await page.waitForTimeout(5000);
  }

  const ttcRows = await page.$$('.job-row');
  console.log('TTC SuccessFactors rows after click:', ttcRows.length);
  if (ttcRows.length > 0) {
    console.log('TTC Row Sample:', await ttcRows[0]?.innerText());
  }

  console.log('--- Waterfront Toronto ---');
  await page.goto('https://www.waterfrontoronto.ca/opportunities/join-our-team', { waitUntil: 'networkidle' });
  // Jobs are likely under a specific heading or in a list
  const text = await page.evaluate(() => document.body.innerText);
  console.log('Waterfront contains "Job" or "Opportunity"?', text.includes('Job') || text.includes('Opportunity'));
  const links = await page.$$eval('a', as => as.filter(a => a.href.includes('.pdf') || a.innerText.toLowerCase().includes('job')).map(a => ({ text: a.innerText, href: a.href })));
  console.log('Waterfront potential job links:', links);

  await browser.close();
}

debug();
