import { chromium } from 'playwright';

async function scrapeMetrolinx() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  console.log('Visiting Metrolinx eeho...');
  try {
    await page.goto('https://eeho.fa.ca2.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1/requisitions', { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(15000);
    await page.screenshot({ path: 'eeho_debug.png' });

    const html = await page.content();
    console.log('HTML Length:', html.length);
    if (html.length < 1000) {
      console.log('Page content seems too short, might not have loaded.');
    }

    // Look for job items with more generic selectors first
    const jobItems = await page.$$('.job-card, .job-tile, li, [role="listitem"], a');
    console.log('Found potential links/items:', jobItems.length);

    const titles = await page.$$eval('h3, a.job-title-link, .job-title, [class*="job-title"]', (els) => els.map(e => e.textContent?.trim()).filter(Boolean));
    console.log('Titles found:', titles);
  } catch (err: any) {
    console.error('Failed:', err.message);
  }

  await browser.close();
}

scrapeMetrolinx();
