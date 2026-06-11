# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Standardized "ActionGroup" icons (Apply, Bookmark) consistent across list and detail views.
- Automatic Title Case normalization for all-caps job titles (e.g., TTC roles).
- Enhanced description parsing to strip leading punctuation and redundant metadata.
- Structured detail panels for "Responsibilities" and "Qualifications" with improved typography.
- Persistent baseline-aligned header layout for all navigation items.

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
