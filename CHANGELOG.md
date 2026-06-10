# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Premium UI redesign inspired by JustShipped.Dev:
  - Clean monochrome aesthetic with bold, high-contrast typography.
  - Centered 800px readable layout with generous vertical spacing.
  - Interactive job rows with hover-opacity effects.
- Enhanced data normalization for job metadata:
  - Numeric-only extraction for "Number of Vacancies".
  - Human-friendly "Work Mode" labels (In-person, Hybrid, Remote).
  - Cleaned salary strings (removed "Information:" and trailing junk).
- Integrated Source filtering with improved minimal UI.

### Changed
- Removed all-caps styling from entire application (headers, badges, labels).
- Refactored job details page with streamlined metadata panels and focused typography.
- Improved header navigation for "Jobs" and "Companies" views.

### Changed
- Refactored all grid/card layouts into high-density horizontal lists.
- Unified the header and navigation menu across all application views.
- Improved data normalization for titles, departments, and deadlines.
- Optimized font scaling for professional information density.

### Fixed
- Fixed salary parsing to exclude "Information" and other trailing text.
- Fixed search bar clipping and styling inconsistencies.
- Corrected "General" department fallback display.
