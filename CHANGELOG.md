# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed
- Fixed toggle-save always returning 400 — handler was reading `?id=` query param but the client posts to `/api/jobs/{id}/toggle-save`; now extracts `id` from the URL path.
- Wired up DOMPurify to sanitize `renderMarkdown` output before it is injected via `dangerouslySetInnerHTML`.

### Added
- Activated 7 previously-commented sources: Province of Ontario (OPS), York Region, Peel Region, Halton Region, City of Mississauga, City of Brampton, and City of Vaughan.
- Added Durham Region scraper (PeopleSoft Fluid UI — two-phase list + Next Job traversal).
- Added City of St. Catharines scraper (Taleo — direct `viewRequisition` URLs).
- Added City of Welland scraper (Avanti — table with direct `/careers/Job/Details/` URLs).
- Added City of Brantford scraper (custom CMS — crawls full-time, part-time, seasonal, and student sub-pages).
- Added City of Hamilton scraper (BambooHR direct portal); added generic `scrapeBambooHR` engine for direct BambooHR portals.

### Refactored
- Split `scraper/scraper.ts` (~1250 lines) into `scraper/utils.ts` (shared helpers) and 14 engine modules under `scraper/engines/` (successfactors, workday, njoyn, oracle, dayforce, jobs2web, icims, hrsmart, ultipro, adp, taleo, avanti, bamboohr, talentpoolbuilder, custom). `scraper.ts` is now a ~95-line orchestrator with imports and `main()` only.

### Changed
- Extracted `renderMarkdown`, `formatSalary`, `daysUntilClose`, `fixCasing` from `App.tsx` into `src/utils.ts`.
- Replaced per-function `createClient()` calls in API handlers with a shared `api/_db.ts` factory.
- Removed stale root-level `vercel.json` (was a workaround before Vercel root directory was set to `web`).
- Exported `scrapeConservationHalton` and `scrapeADP` from `scraper.ts`; added `scraper/test-new-sources.ts` for one-off targeted testing of new scrapers.

## [1.3.1] - 2026-06-24

### Fixed
- Fixed Vercel git integration build failure — moved build config to a root-level `vercel.json` so Vercel correctly builds from the `web/` subdirectory instead of the repo root.

## [1.3.0] - 2026-06-23

### Fixed
- Fixed Vercel deployment failing with `vite: command not found` — root `.gitignore` had `*.json` blocking `vercel.json`; added `vercel.json` with `installCommand: npm install --include=dev` so Vercel keeps devDependencies during build.

### Added
- 16 new sources across crown corps, conservation authorities, federal, and GTHA regional portals.
- 8 new generic scraper engines: `scrapeJobs2Web`, `scrapeDayforce`, `scrapeUltiPro`, `scrapeTalentPoolBuilder`, `scrapeADP`, `scrapeBarrie`, `scrapeConservationHalton`, `scrapeCambridge`.
- Government of Canada (GC Jobs / PSC) activated — covers all public-facing federal departments including Transport Canada and Statistics Canada.

## [1.2.0] - 2026-06-23

### Added
- Job detail sidebar now reads structured DB fields directly (`work_model`, `employment_type`, `duration`, `union_name`, `benefits`) instead of regex-parsing description text — fields actually populate now.
- Job detail body renders AI-cleaned description as formatted HTML (headings, bold, bullet lists) instead of raw markdown.
- Company name in job detail is clickable — navigates to Companies view filtered by that source.
- Salary displayed in `$116K – $161K / yr` format using structured `salary_min`/`salary_max`/`salary_period` DB fields.
- "See more →" under both home sections: Recent → sorted newest-first; Closing Soon → closing-soon filter active, soonest on top.
- "View Full Posting" button links to original job URL.

### Fixed
- Fixed nav bar vertical alignment — all items now center-aligned.
- Fixed sidebar text overflow — long department/location names wrap instead of being cut off.
- Fixed Saved nav item missing icon to match Search.

## [1.1.0] - 2026-06-22

### Added
- Deployed web frontend to Vercel with Vercel Functions serving `/api/jobs` and `/api/jobs/[id]/toggle-save` backed by Turso.
- Added Vercel Analytics.

### Fixed
- Fixed Metrolinx (Oracle Cloud) returning 0 jobs — title lives in `aria-labelledby` target, not the `<a>` tag text.
- Removed Toronto Public Library (Njoyn) from active scraping — blocked by Radware bot protection.

## [1.0.1] - 2026-06-22

### Fixed
- Fixed scraper silently succeeding on GitHub Actions due to `headless: false` — Chromium can't open a window on a CI server, causing an instant crash that was swallowed by `.catch(console.error)`. Browser now launches headless automatically when no `$DISPLAY` is available.
- Fixed `job_scrape.yml` missing `TURSO_URL` and `TURSO_AUTH_TOKEN` secrets — `initDb()` would have crashed after the browser fix landed.
- Fixed `job_scrape.yml` missing the Run Parser step — raw jobs were never being processed into structured job records.
- Removed useless "Upload jobs.sqlite" artifact step from `job_scrape.yml` — the DB writes to Turso, not a local file, so the artifact was always empty.
- Scraper now exits with code 1 on unhandled crash so GitHub Actions correctly reports failures instead of false success.

### Changed
- Expired jobs are no longer clickable — card stays visible in the list but detail view is disabled.
- Upgraded GitHub Actions Node.js runtime from v20 to v24 in both `scrape.yml` and `job_scrape.yml` to resolve runner deprecation warnings.

## [1.0.0] - 2026-06-17

### Added
- **DeepSeek V4-Flash Integration**: Upgraded parsing engine to the latest V4-Flash model, achieving improved extraction quality and reduced latency.
- **Dynamic Date Injection**: Prompt logic now dynamically injects the current date, ensuring 100% accurate calculation of relative closing dates (e.g., "Closing in 2 weeks").
- **Toronto Core Focus**: Concentrated scraper execution on high-priority Toronto sources: City of Toronto, TTC, Toronto Public Library, Metrolinx, and Waterfront Toronto.
- **Recursive Redirection Handling**: Robust handling for government portals (GC/OPS) that follow interstitial "Leaving site" pages up to 3 levels deep.
- **Automated Scheduling**: Configured GitHub Actions for bi-weekly scraping (Sun/Wed) with secure secret management.
- **Turso Cloud Database**: Migrated from local SQLite to Turso (libsql) so scraped data persists in the cloud and GitHub Actions runs write to a real database instead of a throwaway artifact.
- **README**: Added project README in standard format.
- **Toronto Public Library (TPL) Scraper**: New scraper for TPL jobs via the Njoyn portal.

### Changed
- Migrated from fragile CSS/Regex parsing to a unified, AI-driven architecture for structured data extraction.
- **Rich Schema Support**: Database and parser now capture numerical salary ranges, work models (Hybrid/Remote), and specific benefits.
- Updated browser stealth configuration with modern User Agent strings to bypass fake login walls.

### Fixed
- Resolved hardcoded reference date bug in AI prompts that would have degraded future data integrity.
- Fixed duplicate variable declarations in `ai_parser.ts`.
- Replaced over-sensitive "Internal Job" guards that were incorrectly blocking public government postings.

...
- New **Province of Ontario (OPS)** scraper support (provincial jobs via gojobs portal).
- New **Peel Region** scraper support (iCIMS portal).
- New **City of Burlington** scraper support (Avanti portal).
- New **Workday** scraper engine (added City of Brampton, Town of Ajax).
- New **Njoyn** scraper engine (added City of Vaughan, City of Oshawa).
- Expanded municipal coverage: Added Markham, Richmond Hill, Whitby, Milton, Guelph, and Kitchener.
- Total coverage expanded to **22 government job sources**.
- Transitioned to **Soft-Delete** data retention: stale jobs are now marked as "Expired" rather than being deleted from the database.
- Added **Inventory Job Filtering**: Ongoing recruitments and resume banks are now flagged in the database (`is_inventory`) and hidden by default in the UI to reduce feed clutter.
- Added "Ongoing/Inventory" toggle to the UI filters sidebar and an "INVENTORY" badge to associated job rows.
- New "Expired" UI status badge and dimmed styling for inactive job postings.
- Pagination support for **SuccessFactors** scrapers (now fetching 72+ City of Toronto jobs).
- Sequential scraping logic with fresh browser pages per source to eliminate network cross-talk and "interrupted navigation" errors.
- Intentional 1s delays between detail page requests to improve stability and avoid bot detection.
- Detailed per-source and per-item logging for improved debugging of extraction failures.
- Automatic "Scroll to Bottom" logic before pagination checks to reveal hidden buttons.
- Real-time progress tracking in console for long-running detail scraping tasks.
- Overhauled Federal/Provincial scrapers with multi-step "human-like" navigation to bypass session blocks.

### Changed
- Refactored Metrolinx scraper to target new **Oracle Cloud** portal (updated URL and selector strategy).
- Updated SuccessFactors scrapers for Toronto, TTC, and Mississauga to use `career17` subdomains.
- Standardized use of `textContent` and `Element` types across all scrapers for better cross-platform compatibility.
- Improved Job ID extraction logic to handle various URL formats and strip query parameters.

### Fixed
- Fixed critical "Module Not Found" errors by removing incorrect `.js` extensions from TypeScript imports.
- Fixed multiple TypeScript compilation errors (implicit 'any', possible null values in pagination).
- Fixed launch timeouts by switching to non-headless browser mode in local environment.
- Fixed Mississauga scraper picking up navigation links instead of job listings.
- Fixed York Region (HRSmart) pagination to capture all available listings across multiple pages.
- Fixed job detail rendering to support HTML descriptions (removed raw tag display).
- Fixed premature job expiration by increasing the freshness window from 10 minutes to 2 hours.
- Improved description parsing to strip hidden JSON metadata and script tags from portals like BambooHR.
- Improved Government of Canada (GC) descriptions by aggressively stripping out noisy "Share this page" social widgets and modification footers during the scraping phase.
- Fixed UI parsing bug where "Vacancies" would sometimes extract a full sentence with HTML tags; it is now strictly numeric or hidden.
- Fixed "messy" job titles by aggressively filtering out conversational preambles, marketing fluff, and internal job codes during the scraping phase.
- Removed fragile, regex-based "Qualifications" and "Responsibilities" extractions from the UI; the application now relies entirely on the beautifully rendered, clean HTML full descriptions.
- Standardized "ActionGroup" icons (Apply, Bookmark) consistent across list and detail views.

### Changed
- Moved all job metadata (Salary, Mode, Vacancies, etc.) into a focused left sidebar.
- Removed decorative icons from headers and panels for a more minimal, professional look.
- Refactored list rows to a clean, border-bottom style without boxed containers.
- Unified the "Apply" and "Bookmark" actions into a single group across the app.
- Standardized terminology to "Companies" throughout the entire application.

### Fixed
- Fixed persistent header baseline alignment for all navigation items.
- Fixed search bar clipping and "muddy" background issues.
- Fixed filter reset logic to clear filters without navigating away from the current view.
- Ensured `jobs.sqlite` is correctly ignored by git.
