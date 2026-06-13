/**
 * Quick test run — a subset of sources to verify the scraper is working.
 * Run with: npx tsx test_run.ts
 */
import { chromium } from 'playwright';
import { initDb } from './db';
import { scrapeWaterfront, scrapeWorkday, scrapeSuccessFactors, scrapeRawAndStage } from './scraper';

const BASE_CONFIG = {
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36'
};

async function main() {
  console.log('--- TEST RUN (3 sources) ---');
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext(BASE_CONFIG);
  const db = await initDb();

  // Small / no pagination — good smoke test for AI parsing
  await scrapeWaterfront(db, context);

  // Workday — tests the new load-more pagination loop
  await scrapeWorkday(db, context, 'https://brampton.wd3.myworkdayjobs.com/Brampton_External_Careers', 'City of Brampton');

  // SuccessFactors — tests search + pagination + AI parsing on a large source
  await scrapeSuccessFactors(db, context, 'https://career17.sapsf.com/career?company=TTCPRODUCTION&career_ns=job_listing_summary&navBarLevel=JOB_SEARCH', 'TTC', 'https://career17.sapsf.com');

  console.log('\nScrape staged. Run `npm run parse` to process with AI.');
  await browser.close();
}

main().catch(console.error);
