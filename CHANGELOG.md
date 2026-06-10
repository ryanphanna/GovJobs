# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-06-10

### Added
- Initial project prototype for "Toronto Public Sector Feeds".
- Multi-source job scraper using Playwright:
  - City of Toronto (SuccessFactors)
  - TTC Main (SuccessFactors)
  - TTC Internships (Manual link parsing)
  - Waterfront Toronto (Heading-based parsing)
- Local SQLite database for job persistence with `source` and `description` support.
- Express API server to serve jobs via JSON.
- High-density React dashboard with:
  - Compact "Feed" view for quick browsing.
  - "Companies" view for organization-level breakdown.
  - Full-text search and filtering.
  - Source-specific badges and layout optimizations.
- Git repository initialization and remote configuration.
