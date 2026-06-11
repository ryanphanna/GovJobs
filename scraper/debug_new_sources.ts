import { chromium } from 'playwright';

async function testSources() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  const sources = [
    { name: 'Metrolinx', url: 'https://career8.sapsf.com/career?company=Metrolinx', baseUrl: 'https://career8.sapsf.com' },
    { name: 'City of Hamilton', url: 'https://career8.sapsf.com/career?company=cityofhami', baseUrl: 'https://career8.sapsf.com' },
    { name: 'City of Mississauga', url: 'https://career8.sapsf.com/career?company=cityofmiss', baseUrl: 'https://career8.sapsf.com' }
  ];

  for (const source of sources) {
    console.log(`Testing ${source.name}...`);
    try {
      await page.goto(source.url, { waitUntil: 'networkidle', timeout: 30000 });
      console.log(`  [${source.name}] Success! Title: ${await page.title()}`);
      
      const rows = await page.$$('.job-row, .jobResultItem');
      if (rows.length === 0) {
        const btn = await page.$('button:has-text("Search Jobs"), #search_btn');
        if (btn) {
          console.log(`  [${source.name}] Clicking search...`);
          await btn.click();
          await page.waitForTimeout(5000);
        }
      }

      const jobRows = await page.$$('.job-row, .jobResultItem');
      console.log(`  [${source.name}] Found ${jobRows.length} jobs.`);
      
      if (jobRows.length > 0) {
        const titleLink = await jobRows[0].$('.jobTitle-link, .jobTitle');
        console.log(`  [${source.name}] First Job Title: ${await titleLink?.innerText()}`);
      }

    } catch (err: any) {
      console.error(`  [${source.name}] Failed: ${err.message}`);
    }
  }

  await browser.close();
}

testSources();
