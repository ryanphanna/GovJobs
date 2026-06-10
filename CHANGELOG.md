# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-06-10

### Added
- Initial project prototype for "GovJobs".
- Multi-source job scraper using Playwright:
  - City of Toronto (SuccessFactors)
  - TTC Main (SuccessFactors)
  - TTC Internships (Manual link parsing)
  - Waterfront Toronto (Heading-based parsing)
- Local SQLite database for job persistence.
- Express API server to serve jobs via JSON.
- High-density React dashboard with Jobs and Companies views.
- Advanced description parsing for Salary, Vacancies, and Work Mode.
- Responsive grid and list layouts for maximum information density.
- Persistent navigation header and full-page job details view.
