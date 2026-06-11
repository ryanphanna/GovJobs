import { chromium } from 'playwright';

async function testSubdomains() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  const subdomains = ['career8', 'career17', 'career4', 'career2', 'career5'];
  const companies = ['Metrolinx', 'cityofhami', 'cityofmiss'];

  for (const sub of subdomains) {
    for (const comp of companies) {
      const url = `https://${sub}.sapsf.com/career?company=${comp}`;
      console.log(`Testing ${url}...`);
      try {
        await page.goto(url, { waitUntil: 'networkidle', timeout: 5000 });
        console.log(`  SUCCESS: ${url} -> ${await page.title()}`);
      } catch (err) {
        // Skip
      }
    }
  }

  await browser.close();
}

testSubdomains();
