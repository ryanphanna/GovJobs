# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Homepage "Peek" view showing top 5 "Most Recent Postings" and "Closing Soon".
- Unique internal ID routing with hash-based paths (`#job/{id}`, `#saved`, etc.).
- Universal header baseline (bottom-justified) alignment for consistent typography.
- Expandable search integration with smooth right-aligned transitions.
- Standardized "ActionGroup" icons (Apply, Bookmark) consistent across list and detail views.
- Local "Saved Jobs" (bookmarking) feature with persistent SQLite storage.
- Advanced multi-dimension filtering (Salary, Work Mode, Deadline).

### Changed
- Refactored entire UI to high-density, horizontal lists (removed all cards and table headers).
- Simplified "Jobs" and "Companies" views for faster scanning.
- Unified sidebar positioning: All metadata moved to the left for layout stability.
- Improved data normalization:
  - Automatic Title Case conversion for all-caps titles.
  - Stripped job codes, internal IDs, and "Job Opportunity" junk text.
  - Vacancies are strictly numeric; Salary strings are cleaned of "Information:" suffixes.
  - Description parsing improved to remove leading commas, periods, and redundant metadata.
- Standardized terminology to "Companies" across the entire application.
- Removed decorative icons from headers and panels for a more minimal, professional look.

### Fixed
- Fixed persistent header baseline alignment for all navigation items.
- Fixed search bar clipping and "muddy" background issues.
- Fixed filter reset logic to clear filters without navigating away from the current view.
- Ensured `jobs.sqlite` is correctly ignored by git.
