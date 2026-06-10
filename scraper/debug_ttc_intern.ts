import { chromium } from 'playwright';

async function debug() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  console.log('--- TTC Interns ---');
  await page.goto('https://www.ttc.ca/Jobs/Early-Talent/Early-Talent-Intern-Program/Intern-Opportunities', { waitUntil: 'networkidle' });
  
  const content = await page.content();
  // Look for any links that might be specific jobs
  const links = await page.$$eval('a', as => as.map(a => ({ text: a.innerText, href: (a as HTMLAnchorElement).href })));
  console.log('Links on TTC Intern page:', links.filter(l => l.text.length > 5 && !l.text.includes('TTC')));

  await browser.close();
}

debug();
