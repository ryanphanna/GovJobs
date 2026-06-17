# GovJobs

A government job discovery feed that scrapes and unifies postings from across the GTHA into a single searchable interface.

## Problem

Government job postings are scattered across dozens of incompatible portals — SuccessFactors, Oracle Cloud, Workday, Njoyn, and bespoke municipal sites. There is no single place to browse public sector opportunities across the region without checking each organization individually.

## Features

- **Multi-Portal Scraping**: Automated collection from City of Toronto, TTC, Metrolinx, Toronto Public Library, Waterfront Toronto, Government of Canada, and 15+ additional GTHA sources.
- **AI-Powered Parsing**: DeepSeek V4-Flash extracts structured fields (salary range, work model, employment type, closing date) from raw job page text with no brittle selectors.
- **Unified Feed**: Filter by student eligibility, work model, salary, union status, and source across all scraped postings in one view.
- **Soft-Delete Retention**: Expired postings are flagged rather than deleted, preserving a searchable history of past opportunities.
- **Scheduled Runs**: GitHub Actions triggers bi-weekly scrapes (Mon/Thu) with secure secret management — no manual execution required.

## Stack

- **Scraper**: Playwright, TypeScript
- **AI**: DeepSeek V4-Flash
- **Database**: SQLite
- **API**: Express
- **Frontend**: React, Vite, TypeScript
- **Automation**: GitHub Actions

---

- [Sources](./SOURCES.md)
- [Roadmap](./ROADMAP.md)
- [Changelog](./CHANGELOG.md)

Created by [Ryan Hanna](https://github.com/ryanphanna) | [ryanisnota.pro](https://ryanisnota.pro)
