# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Local "Saved Jobs" (bookmarking) feature:
  - Persistent bookmarking stored in local SQLite database.
  - Dedicated "Saved" view for tracked opportunities.
  - Interactive bookmark icons in list rows and detail views.
- Advanced multi-dimension filtering system:
  - Salary-based filtering (e.g., $75k+, $100k+).
  - Work Mode filtering (In-person, Hybrid, Remote).
  - "Closing soon" toggle for time-sensitive opportunities.
- Expandable Search button in the primary menu with smooth CSS transitions.
- Automatic database cleanup for expired jobs (preserving saved items).

### Changed
- Radical UI density pass:
  - Surgically reduced whitespace, padding, and margins across the application.
  - Ultra-compact list rows for maximum information density.
  - Redesigned metadata grid in detail view for single-screen visibility.
- Improved data extraction and normalization:
  - Vacancies are now strictly numeric.
  - Salary strings cleaned of "Information:" and other junk text.
  - Normalization of "Work Mode" into friendly, consistent labels.
- Moved primary "Apply" button higher in the job detail view for immediate access.

### Changed
- Refactored all grid/card layouts into high-density horizontal lists.
- Unified the header and navigation menu across all application views.
- Improved data normalization for titles, departments, and deadlines.
- Optimized font scaling for professional information density.

### Fixed
- Fixed salary parsing to exclude "Information" and other trailing text.
- Fixed search bar clipping and styling inconsistencies.
- Corrected "General" department fallback display.
