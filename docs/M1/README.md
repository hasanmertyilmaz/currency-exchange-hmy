# M1 — Analysis & Design (Laboratory Group 7)

| File | Content |
|---|---|
| `Group7_M1_Analysis_and_Design.pdf` | M1 report (submitted to Moodle) |
| `Group7_M1_Analysis_and_Design.docx` | Editable version of the report |
| `diagrams/src/*.puml` | Editable diagram sources (PlantUML) |
| `diagrams/png/`, `diagrams/svg/` | Rendered diagrams |
| `database/schema.sql` | PostgreSQL 16 DDL draft of the ERD (becomes the first Flyway migration) |
| `api/api-contract.yaml` | REST API contract outline (OpenAPI 3.1) |

Diagram index:

| Source | Figure in the report |
|---|---|
| `01-use-case.puml` | Figure 1 — Use case diagram |
| `02-class-mobile.puml` | Figure 2 — Class diagram, mobile client |
| `03-class-service.puml` | Figure 3 — Class diagram, web service |
| `09-state-operation.puml` | Figure 4 — State machine of a data-changing operation |
| `04-erd.puml` | Figure 5 — Entity relationship diagram |
| `05-architecture.puml` | Figure 6 — System architecture and data owners |
| `06-seq-read-rates.puml` | Figure 7 — DF-1 normal read |
| `07-seq-buy.puml` | Figure 8 — DF-2 data-changing action |
| `08-seq-lost-response.puml` | Figure 9 — DF-3 recovery after a lost response |

The report is generated from `docs/build/report-content.js`; see `docs/build/README.md`.
At M1 no application code exists yet; the design values are verified at M2/M3.
