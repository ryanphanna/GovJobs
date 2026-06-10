# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] - 2026-06-10

### Added
- Dedicated full-page job details view replacing the modal/sidebar.
- Structured metadata extraction for "Number of Vacancies" and "Future Requirements".
- Direct "Apply on Portal" links integrated into the job list rows.
- Clickable logo to reset application state to the main Jobs list.
- High-density list layout for the "Companies" view.

### Changed
- Refactored "Feed" to "Jobs" as the primary application view.
- Overhauled Job list from a table-grid to a high-density vertical list optimized for scanning.
- Massively reduced font sizes across the application for professional information density.
- Unified the header and navigation menu to be persistent across all views.
- Improved data normalization:
  - Stripped job codes and numeric IDs from titles and departments.
  - Normalized source names and removed all-caps styling.
  - Cleaned up salary strings and date prefixes.
- Reorganized React code into cleaner sub-components for improved maintainability.

### Fixed
- Search bar border clipping and layout alignment issues.
- Muddy search bar appearance caused by browser dark-mode defaults.
- "General" department placeholder replaced with clean display.
