import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';
import { parseJobWithAI } from './ai_parser';

const DB_PATH = path.join(__dirname, '../jobs.sqlite');

async function backfill() {
    const db = await open({
        filename: DB_PATH,
        driver: sqlite3.Database
    });

    console.log("Fetching jobs that need AI parsing...");
    const jobs = await db.all("SELECT id, job_title, description, closing_date FROM jobs WHERE salary_min IS NULL");
    
    console.log(`Found ${jobs.length} jobs to backfill.`);

    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < jobs.length; i++) {
        const job = jobs[i];
        console.log(`[${i + 1}/${jobs.length}] Backfilling: ${job.job_title}`);

        try {
            const aiResult = await parseJobWithAI(job.description);

            if (aiResult) {
                await db.run(`
                    UPDATE jobs SET
                        job_title = ?,
                        department = ?,
                        location = ?,
                        salary_range = ?,
                        description = ?,
                        closing_date = ?,
                        is_inventory = ?,
                        is_student = ?,
                        salary_min = ?,
                        salary_max = ?,
                        salary_period = ?,
                        work_model = ?,
                        employment_type = ?,
                        duration = ?,
                        is_unionized = ?,
                        union_name = ?,
                        benefits = ?
                    WHERE id = ?
                `, [
                    aiResult.job_title,
                    aiResult.department,
                    aiResult.location,
                    `${aiResult.salary_min || ''} - ${aiResult.salary_max || ''} (${aiResult.salary_period})`,
                    aiResult.clean_description,
                    aiResult.closing_date || job.closing_date || '',
                    aiResult.is_inventory ? 1 : 0,
                    aiResult.is_student ? 1 : 0,
                    aiResult.salary_min,
                    aiResult.salary_max,
                    aiResult.salary_period,
                    aiResult.work_model,
                    aiResult.employment_type,
                    aiResult.duration,
                    aiResult.is_unionized ? 1 : 0,
                    aiResult.union_name,
                    JSON.stringify(aiResult.benefits),
                    job.id
                ]);
                successCount++;
                console.log(`   ✅ Success`);
            } else {
                failCount++;
                console.log(`   ❌ AI Parse Failed`);
            }
        } catch (error: any) {
            failCount++;
            console.log(`   ❌ Error: ${error.message}`);
        }

        // Small delay to prevent hitting rate limits too hard
        await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log("\n" + "=".repeat(30));
    console.log("BACKFILL COMPLETE");
    console.log(`Success: ${successCount}`);
    console.log(`Failed:  ${failCount}`);
    console.log("=".repeat(30));

    await db.close();
}

backfill().catch(console.error);
