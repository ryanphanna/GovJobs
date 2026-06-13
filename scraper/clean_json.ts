import { initDb } from './db';

async function cleanJsonData() {
  const db = await initDb();
  console.log('Fetching jobs to clean JSON metadata...');
  
  // Find jobs that have raw JSON bleeding into the description
  const jobs = await db.all(`SELECT id, description FROM jobs WHERE description LIKE '%"@context"%' OR description LIKE '%"@type"%' OR description LIKE '%"identifier"%'`);
  
  console.log(`Found ${jobs.length} jobs to clean.`);
  
  let updatedCount = 0;
  for (const job of jobs) {
    let newDesc = job.description;
    
    // Remove the raw JSON-LD blocks that leaked into the text
    // Because it might not be wrapped in tags anymore (stripped earlier), we regex for the JSON object
    newDesc = newDesc.replace(/\{"?@context"?.*?JobPosting.*?\}/gi, '');
    newDesc = newDesc.replace(/\{"?@type"?.*?PropertyValue.*?\}/gi, '');
    newDesc = newDesc.replace(/\{"?@type"?.*?Organization.*?\}/gi, '');
    newDesc = newDesc.replace(/\{"?@type"?.*?Place.*?\}/gi, '');
    newDesc = newDesc.replace(/\{"?@type"?.*?PostalAddress.*?\}/gi, '');
    
    // Some BambooHR specific cleanups
    newDesc = newDesc.replace(/\{"?[^}]*"identifier"\s*:\s*\{.*?\}\}/gi, '');
    newDesc = newDesc.replace(/\{"?[^}]*"hiringOrganization"\s*:\s*\{.*?\}\}/gi, '');
    newDesc = newDesc.replace(/\{"?[^}]*"jobLocation"\s*:\s*\{.*?\}\}/gi, '');

    if (newDesc !== job.description) {
        await db.run('UPDATE jobs SET description = ? WHERE id = ?', [newDesc, job.id]);
        updatedCount++;
    }
  }
  
  console.log(`Successfully cleaned ${updatedCount} descriptions.`);
}

cleanJsonData().catch(console.error);
