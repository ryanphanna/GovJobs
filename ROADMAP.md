# Roadmap: Navigator Feeds

Feeds is the automated intelligence layer of Navigator, responsible for monitoring public sector portals, bypassing bot detection, and normalizing messy job data into structured assets.

- **[Sources](./SOURCES.md)**: Inventory of active and planned job portals.
- **[Changelog](./CHANGELOG.md)**: Detailed history of scraper engine updates.

### 🏗️ Scraper Architecture
- [x] **AI-Powered Parsing**: Migration to DeepSeek V3 for 100% reliable extraction and description normalization.
- [x] **Recursive Redirections**: Robust handling of interstitial "Warning" pages on government portals.
- [x] **Automated Scheduling**: Bi-weekly scraping (Mon/Thu) via GitHub Actions.
- [ ] **Multi-Model Fallback**: Logic to switch to Gemini if DeepSeek is unavailable.
- [ ] **Direct-to-Cloud Storage**: Move from local SQLite to direct Supabase/PostgreSQL ingestion.

### 🎯 Intelligence & Quality
- [ ] **Job Similarity Detection**: Grouping duplicate postings that appear across different portal types.
- [ ] **Salary Normalization**: Intelligent conversion of hourly/monthly rates to standardized annual benchmarks.
- [ ] **Benefit Classification**: Categorizing perks into standardized tags (Pension, Health, Dental).

### 🚀 Future Targets
- **Regional Expansion**: Adding remaining GTHA regions (Durham, Niagara).
- **Provincial Expansion**: Porting the custom PSC engine to other provinces (BC, Alberta).
- **Public Boards**: Scaping LinkedIn/Indeed for specific "Government" keyword filters.

---

[Back to Home](./README.md)
