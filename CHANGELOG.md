# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Initial project prototype for "GovJobs".
- Multi-source job scraper using Playwright (City of Toronto, TTC, Waterfront Toronto).
- Local SQLite database and Express API server.
- High-density React dashboard with Jobs and Companies list views.
- Dedicated full-page job details view with structured panels (Responsibilities, Qualifications).
- Advanced metadata extraction for Salary, Vacancies, Work Mode, and Future Requirements.
- Source-based filtering and full-text search.
- Direct apply links integrated into the jobs list.

### Changed
- Refactored all grid/card layouts into high-density horizontal lists.
- Unified the header and navigation menu across all application views.
- Improved data normalization for titles, departments, and deadlines.
- Optimized font scaling for professional information density.

### Fixed
- Fixed salary parsing to exclude "Information" and other trailing text.
- Fixed search bar clipping and styling inconsistencies.
- Corrected "General" department fallback display.
