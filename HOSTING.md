# Hosting Guide: Job Feeds Scraper

This scraper can be hosted in several ways. Below are the recommended options.

## 1. GitHub Actions (Recommended / Free)

A workflow file has been created at `.github/workflows/daily_scrape.yml`. 

### Setup:
1. Go to your GitHub Repository **Settings** > **Secrets and variables** > **Actions**.
2. Add a new **Repository Secret**:
   - Name: `DEEPSEEK_API_KEY`
   - Value: `sk-76adfb0e43e34d7c8ffdc48c0333e690`
3. The scraper will now run automatically every day at 6 AM EST.
4. You can download the updated `jobs.sqlite` from the "Actions" tab under "Artifacts".

## 2. Local Hosting (Mac/Linux)

You can run the scraper locally using a `cron` job or `launchd`.

### Manual Run:
```bash
cd scraper
npm install
npx tsx scraper.ts
```

## 3. VPS (Railway / Render / DigitalOcean)

If you need a more permanent database, consider switching from `sqlite` to **Supabase (PostgreSQL)**.

1. Create a Supabase project.
2. Update `db.ts` to use `@supabase/supabase-js`.
3. Deploy the `scraper` folder as a Background Worker.

---

### Important Notes:
- **Bot Detection:** Some government sites (like GC or OPS) may block GitHub Actions IP ranges. If you see high failure rates in GitHub, hosting on a local machine or a residential-proxy VPS is recommended.
- **Cost:** AI parsing costs ~$0.0005 per job. A full run of ~500 jobs costs roughly $0.25.
