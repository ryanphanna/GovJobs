import express from 'express';
import cors from 'cors';
import { initDb } from './db.js';

const app = express();
const port = 3001;

app.use(cors());
app.use(express.json());

app.get('/api/jobs', async (req, res) => {
  const db = await initDb();
  const jobs = await db.all('SELECT * FROM jobs ORDER BY scraped_at DESC');
  res.json(jobs);
});

app.listen(port, () => {
  console.log(`API server running at http://localhost:${port}`);
});
