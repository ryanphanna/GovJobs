import { chromium } from 'playwright';
import { initDb, cleanupExpiredJobs } from './db';
import { BASE_CONFIG } from './utils';

import { scrapeSuccessFactors } from './engines/successfactors';
import { scrapeWorkday } from './engines/workday';
import { scrapeNjoyn } from './engines/njoyn';
import { scrapeOracleCloud } from './engines/oracle';
import { scrapeDayforce } from './engines/dayforce';
import { scrapeJobs2Web } from './engines/jobs2web';
import { scrapeICIMS } from './engines/icims';
import { scrapeHRSmart } from './engines/hrsmart';
import { scrapeUltiPro } from './engines/ultipro';
import { scrapeADP } from './engines/adp';
import { scrapeTaleo } from './engines/taleo';
import { scrapeAvanti } from './engines/avanti';
import { scrapeBambooHR, scrapeCreateTO } from './engines/bamboohr';
import { scrapeTalentPoolBuilder } from './engines/talentpoolbuilder';
import {
  scrapeOPS,
  scrapeGC,
  scrapeWaterfront,
  scrapeBarrie,
  scrapeCambridge,
  scrapeConservationHalton,
  scrapeDurhamRegion,
  scrapeBrantford,
} from './engines/custom';

export { scrapeSuccessFactors, scrapeWorkday, scrapeWaterfront, scrapeConservationHalton, scrapeADP };
export { urlId, scrapeRawAndStage } from './utils';

async function main() {
  const runStartedAt = new Date().toISOString();
  const headless = !process.env.DISPLAY && process.env.CI !== 'false';
  console.log(`Launching browser (headless: ${headless})...`);
  const browser = await chromium.launch({ headless });
  const context = await browser.newContext(BASE_CONFIG);
  const db = await initDb();

  console.log('--- STARTING TORONTO SCRAPE RUN ---');

  // 1. Core Toronto Agencies
  await scrapeSuccessFactors(db, context, 'https://career17.sapsf.com/career?company=TTCPRODUCTION&career_ns=job_listing_summary&navBarLevel=JOB_SEARCH', 'TTC', 'https://career17.sapsf.com');
  await scrapeSuccessFactors(db, context, 'https://jobs.toronto.ca/jobsatcity/', 'City of Toronto', 'https://jobs.toronto.ca');
  await scrapeOracleCloud(db, context, 'https://ehtc.fa.ca2.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1/jobs?mode=location', 'Metrolinx');

  // 2. Libraries & Specialized
  // TPL (Njoyn) blocked by Radware bot protection — cannot scrape headlessly
  await scrapeWaterfront(db, context);

  // 3. Crown Corps & Conservation
  await scrapeJobs2Web(db, context, 'https://careers.cmhc-schl.gc.ca/search/', 'CMHC');
  await scrapeDayforce(db, context, 'https://jobs.dayforcehcm.com/trca/CANDIDATEPORTAL', 'TRCA');
  await scrapeDayforce(db, context, 'https://jobs.dayforcehcm.com/en-US/infrastructureontario/CANDIDATEPORTAL', 'Infrastructure Ontario');
  await scrapeCreateTO(db, context);
  await scrapeBarrie(db, context);
  await scrapeNjoyn(db, context, 'https://cityofoshawa.njoyn.com/CL/xweb/Xweb.asp?tbtoken=ZlxYRhoXCBtxZi4lLkAuJF4DNyQmCFQ9dmxEcFFZe0ggUikFE2BcKkocUDcTdmUELiUuQC4kXgkbVRdUT3NsF3U%3D&chk=ZVpaShM%3D&page=joblisting&CLID=126638', 'City of Oshawa');
  await scrapeWorkday(db, context, 'https://ajax.wd10.myworkdayjobs.com/Ajax', 'Town of Ajax');
  await scrapeUltiPro(db, context, 'https://recruiting.ultipro.ca/COR5003CALED/JobBoard/55e2803a-385b-47b1-b911-51dd7ed81d1e/?q=&o=postedDateDesc', 'Town of Caledon');
  await scrapeWorkday(db, context, 'https://niagarafalls.wd10.myworkdayjobs.com/CNF', 'City of Niagara Falls');
  await scrapeJobs2Web(db, context, 'https://careers.london.ca/search/', 'City of London');
  await scrapeJobs2Web(db, context, 'https://jobs.kitchener.ca/search/', 'City of Kitchener');
  await scrapeTalentPoolBuilder(db, context, 'https://cityofwaterloo.talentpoolbuilder.com/', 'City of Waterloo');
  await scrapeCambridge(db, context);
  await scrapeConservationHalton(db, context);
  await scrapeADP(db, context, 'https://workforcenow.adp.com/mascsr/default/mdf/recruitment/recruitment.html?cid=09ed440f-e109-4f6f-ac03-075ea0a3a5e5&ccId=19000101_000001&lang=en_CA', 'Municipality of Clarington');

  // 4. Federal
  await scrapeGC(db, context);

  // 5. Province of Ontario
  await scrapeOPS(db, context);

  // 6. GTHA Regions & Cities
  await scrapeDurhamRegion(db, context);
  await scrapeHRSmart(db, context, 'https://york.hua.hrsmart.com/hr/ats/JobSearch/viewAll', 'York Region');
  await scrapeICIMS(db, context, 'https://careers-peelregion.icims.com/jobs/search?ss=1', 'Peel Region');
  await scrapeSuccessFactors(db, context, 'https://careers.halton.ca/search/', 'Halton Region', 'https://careers.halton.ca');
  await scrapeSuccessFactors(db, context, 'https://jobs.mississauga.ca/search/', 'Mississauga', 'https://jobs.mississauga.ca');
  await scrapeWorkday(db, context, 'https://brampton.wd3.myworkdayjobs.com/Brampton_External_Careers', 'City of Brampton');
  await scrapeNjoyn(db, context, 'https://vaughan.njoyn.com/cl4/xweb/xweb.asp?tbtoken=ZlpRRhcXCB8GYwF0NyVccitLdGZfcVVMf0gjV1oMExdbW0UZXUcbBhdxcBEbURRTSXUuX30%3D&chk=ZVpaShM%3D&CLID=52423&page=joblisting', 'City of Vaughan');
  await scrapeTaleo(db, context, 'https://tre.tbe.taleo.net/tre01/ats/careers/v2/searchResults?org=COSC&cws=37', 'City of St. Catharines');
  await scrapeAvanti(db, context, 'https://welland.myavanti.ca/careers', 'City of Welland');
  await scrapeBrantford(db, context);
  await scrapeBambooHR(db, context, 'https://cityofhamilton.bamboohr.com/careers', 'City of Hamilton');

  console.log('\nCleaning up expired jobs...');
  await cleanupExpiredJobs(db, runStartedAt);

  console.log('All scraping tasks complete.');
  await browser.close();
}

if (require.main === module) {
  main().catch(err => { console.error(err); process.exit(1); });
}
