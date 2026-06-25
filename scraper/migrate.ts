import { createClient } from '@libsql/client';
import dotenv from 'dotenv';
dotenv.config();

async function migrate() {
  const db = createClient({
    url: process.env.TURSO_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN!,
  });

  // Step 1: Save AI data into a temp table before touching jobs
  console.log('Step 1: Staging AI data into job_details_temp...');
  await db.execute(`DROP TABLE IF EXISTS job_details_temp`);
  await db.execute(`
    CREATE TABLE job_details_temp AS
    SELECT
      id, job_title, department, location, salary_range, description, closing_date,
      is_inventory, is_student, salary_min, salary_max, salary_period,
      work_model, employment_type, duration, is_unionized, union_name, benefits
    FROM jobs
    WHERE job_title IS NOT NULL
  `);
  const staged = await db.execute(`SELECT COUNT(*) as n FROM job_details_temp`);
  console.log(`  Staged ${staged.rows[0]!['n']} rows.`);

  // Step 2: Build the new slim jobs table
  console.log('Step 2: Building jobs_new (scraper fields only)...');
  await db.execute(`DROP TABLE IF EXISTS jobs_new`);
  await db.execute(`
    CREATE TABLE jobs_new (
      id TEXT PRIMARY KEY,
      url TEXT,
      source TEXT,
      is_active INTEGER DEFAULT 1,
      is_saved INTEGER DEFAULT 0,
      scraped_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await db.execute(`
    INSERT INTO jobs_new (id, url, source, is_active, is_saved, scraped_at)
    SELECT id, url, source, is_active, is_saved, scraped_at FROM jobs
  `);
  const jobCount = await db.execute(`SELECT COUNT(*) as n FROM jobs_new`);
  console.log(`  Copied ${jobCount.rows[0]!['n']} rows.`);

  // Step 3: Swap jobs tables (SQLite FKs are off by default so no cascade needed)
  console.log('Step 3: Swapping jobs → jobs_new...');
  await db.execute(`DROP TABLE IF EXISTS job_details`);
  await db.execute(`DROP TABLE jobs`);
  await db.execute(`ALTER TABLE jobs_new RENAME TO jobs`);

  // Step 4: Create job_details and populate from temp
  console.log('Step 4: Creating job_details and restoring AI data...');
  await db.execute(`
    CREATE TABLE job_details (
      id TEXT PRIMARY KEY REFERENCES jobs(id),
      job_title TEXT,
      department TEXT,
      location TEXT,
      salary_range TEXT,
      description TEXT,
      closing_date TEXT,
      is_inventory INTEGER DEFAULT 0,
      is_student INTEGER DEFAULT 0,
      salary_min NUMBER,
      salary_max NUMBER,
      salary_period TEXT,
      work_model TEXT,
      employment_type TEXT,
      duration TEXT,
      is_unionized INTEGER,
      union_name TEXT,
      benefits TEXT
    )
  `);
  await db.execute(`
    INSERT INTO job_details
    SELECT * FROM job_details_temp
    WHERE id IN (SELECT id FROM jobs)
  `);
  const detailCount = await db.execute(`SELECT COUNT(*) as n FROM job_details`);
  console.log(`  Restored ${detailCount.rows[0]!['n']} rows into job_details.`);

  // Step 5: Cleanup
  await db.execute(`DROP TABLE job_details_temp`);

  console.log('\nMigration complete.');
  console.log(`jobs: scraper fields only (${jobCount.rows[0]!['n']} rows)`);
  console.log(`job_details: AI fields (${detailCount.rows[0]!['n']} rows)`);
  process.exit(0);
}

migrate().catch(err => { console.error(err); process.exit(1); });
