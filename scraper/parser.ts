import { initDb, getUnparsedJobs, saveJob, markJobParsed, cleanupExpiredJobs } from './db';
import { parseJobWithAI } from './ai_parser';

const CONCURRENCY = 5;

async function main() {
  const db = await initDb();
  const rawJobs = await getUnparsedJobs(db);

  if (rawJobs.length === 0) {
    console.log('[Parser] Nothing to parse.');
    return;
  }

  console.log(`[Parser] Parsing ${rawJobs.length} jobs (${CONCURRENCY} concurrent)...`);
  let done = 0;

  for (let i = 0; i < rawJobs.length; i += CONCURRENCY) {
    const batch = rawJobs.slice(i, i + CONCURRENCY);
    await Promise.all(batch.map(async (raw) => {
      const aiResult = await parseJobWithAI(raw.raw_text);
      if (aiResult) {
        await saveJob(db, {
          id: raw.id,
          job_title: aiResult.job_title,
          department: aiResult.department,
          location: aiResult.location,
          salary_range: (aiResult.salary_min || aiResult.salary_max)
            ? `${aiResult.salary_min ?? ''} - ${aiResult.salary_max ?? ''} (${aiResult.salary_period})`
            : '',
          description: aiResult.clean_description,
          closing_date: aiResult.closing_date || '',
          url: raw.url,
          source: raw.source,
          is_inventory: aiResult.is_inventory ? 1 : 0,
          is_student: aiResult.is_student ? 1 : 0,
          salary_min: aiResult.salary_min,
          salary_max: aiResult.salary_max,
          salary_period: aiResult.salary_period,
          work_model: aiResult.work_model,
          employment_type: aiResult.employment_type,
          duration: aiResult.duration,
          is_unionized: aiResult.is_unionized ? 1 : 0,
          union_name: aiResult.union_name,
          benefits: JSON.stringify(aiResult.benefits),
        });
        await markJobParsed(db, raw.id);
        done++;
        process.stdout.write(`\r[Parser] ${done}/${rawJobs.length} ✅`);
      } else {
        process.stdout.write(`\r[Parser] ${done}/${rawJobs.length} ❌ (${raw.source}: ${raw.url.slice(-40)})`);
      }
    }));
  }

  // Expire jobs that weren't in the current scrape run
  const runMetaResult = await db.execute(
    `SELECT MIN(scraped_at) as started_at FROM raw_jobs WHERE scraped_at > datetime('now', '-12 hours')`
  );
  const startedAt = runMetaResult.rows[0]?.started_at as string | null;
  if (startedAt) {
    await cleanupExpiredJobs(db, startedAt);
    console.log('\n[Parser] Expired stale jobs.');
  }

  console.log('[Parser] Done.');
}

main().catch(console.error);
