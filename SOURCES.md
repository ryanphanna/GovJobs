# Job Sources Inventory

This document tracks all active portals monitored by the Navigator Feeds scraper.

## Active (Toronto Core)
| Source | Portal Type | URL |
| :--- | :--- | :--- |
| **City of Toronto** | SuccessFactors | [Jobs at City](https://jobs.toronto.ca/jobsatcity/) |
| **TTC** | SuccessFactors | [Careers](https://careers.ttc.ca/) |
| **Toronto Public Library** | Njoyn | [Library Jobs](https://www.torontopubliclibrary.ca/about-the-library/library-jobs/) |
| **Metrolinx** | Oracle Cloud | [Careers](https://ehtc.fa.ca2.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1/jobs) |
| **Waterfront Toronto** | Custom | [Opportunities](https://www.waterfrontoronto.ca/opportunities/join-our-team) |

## Active (Crown Corps & Conservation)
| Source | Portal Type | URL |
| :--- | :--- | :--- |
| **CMHC** | Jobs2Web | [Careers](https://careers.cmhc-schl.gc.ca/search/) |
| **TRCA** | Dayforce HCM | [Candidate Portal](https://jobs.dayforcehcm.com/trca/CANDIDATEPORTAL) |
| **Infrastructure Ontario** | Dayforce HCM | [Candidate Portal](https://jobs.dayforcehcm.com/en-US/infrastructureontario/CANDIDATEPORTAL) |
| **CreateTO** | BambooHR (via static page) | [Careers](https://createto.ca/about-us/careers) |

---

## Active (Federal)
| Source | Portal Type | URL |
| :--- | :--- | :--- |
| **Government of Canada** | Custom (PSC/GC Jobs) | [GC Jobs](https://emploisfp-psjobs.cfp-psc.gc.ca/psrs-srfp/applicant/page2440?fromMenu=true&toggleLanguage=en) |

> Covers all public-facing federal departments incl. **Transport Canada**, **Statistics Canada**, Infrastructure Canada, CMHC (duplicate — own engine takes priority), and others.

## Active (Provincial)
| Source | Portal Type | URL |
| :--- | :--- | :--- |
| **Province of Ontario (OPS)** | Custom (gojobs) | [Ontario Public Service Jobs](https://www.gojobs.gov.on.ca/Jobs.aspx) |

## Active (GTHA & Regional)
| Source | Portal Type | URL |
| :--- | :--- | :--- |
| **York Region** | HRSmart | [Job Search](https://york.hua.hrsmart.com/hr/ats/JobSearch/viewAll) |
| **Peel Region** | iCIMS | [Careers](https://careers-peelregion.icims.com/jobs/search?ss=1) |
| **Halton Region** | SuccessFactors | [Search](https://careers.halton.ca/search/) |
| **City of Mississauga** | SuccessFactors | [Search](https://jobs.mississauga.ca/search/) |
| **City of Brampton** | Workday | [Careers](https://brampton.wd3.myworkdayjobs.com/Brampton_External_Careers) |
| **City of Vaughan** | Njoyn | [Job Listing](https://vaughan.njoyn.com/cl4/xweb/xweb.asp) |
| **City of Oshawa** | Njoyn | [Job Listing](https://cityofoshawa.njoyn.com/CL/xweb/Xweb.asp) |
| **Town of Ajax** | Workday | [Careers](https://ajax.wd10.myworkdayjobs.com/Ajax) |
| **City of Barrie** | Custom | [Search](https://careers.barrie.ca/search/) |
| **Town of Caledon** | UltiPro (UKG) | [Job Board](https://recruiting.ultipro.ca/COR5003CALED/JobBoard/55e2803a-385b-47b1-b911-51dd7ed81d1e/) |
| **City of Niagara Falls** | Workday | [Careers](https://niagarafalls.wd10.myworkdayjobs.com/CNF) |
| **City of London** | Jobs2Web | [Careers](https://careers.london.ca/search/) |
| **City of Kitchener** | Jobs2Web | [Search](https://jobs.kitchener.ca/search/) |
| **City of Waterloo** | TalentPoolBuilder | [Job Board](https://cityofwaterloo.talentpoolbuilder.com/) |
| **City of Cambridge** | Custom (CMS → SuccessFactors) | [Opportunities](https://www.cambridge.ca/mayor-city-council-government/careers-volunteering/current-opportunities/) |
| **Conservation Halton** | WordPress accordion | [Employment](https://www.conservationhalton.ca/about-us/employment/) |
| **Municipality of Clarington** | ADP WorkforceNow | [Careers](https://workforcenow.adp.com/mascsr/default/mdf/recruitment/recruitment.html?cid=09ed440f-e109-4f6f-ac03-075ea0a3a5e5&ccId=19000101_000001&lang=en_CA) |
| **Durham Region** | PeopleSoft Fluid | [Job Search](https://recruitregion.durham.ca/psc/recruit_rmd/EMPLOYEE/HRMS/c/HRS_HRAM_FL.HRS_CG_SEARCH_FL.GBL?Page=HRS_APP_SCHJOB&Action=U&FOCUS=Applicant&SiteId=3) |
| **City of St. Catharines** | Taleo | [Careers](https://tre.tbe.taleo.net/tre01/ats/careers/v2/searchResults?org=COSC&cws=37) |
| **City of Welland** | Avanti | [Careers](https://welland.myavanti.ca/careers) |
| **City of Brantford** | Custom CMS | [Current Opportunities](https://www.brantford.ca/your-government/careers/current-opportunities/) |

## Planned / Expansion
See `PENDING.md` for sources not yet active, with notes on status and blockers.

---

## Parser Engine
All active sources utilize the **DeepSeek V4-Flash** AI parser for structured data extraction and description normalization.
