# Kantor Mobile — Mobile Currency Exchange System

Laboratory project for **Network Issues in Mobile Systems (2026–2027)**, VIZJA University.
Laboratory Group 7 · Supervisor: Marcin Kacprowicz

| Team member | Primary area |
|---|---|
| Duygu Toplu | Mobile client (React Native / Expo), offline UX, client-side cache |
| Hasan Mert Yilmaz | Web service (Java / Spring Boot), PostgreSQL, NBP integration, consistency |

## Topic

**Project A — Mobile Currency Exchange System.** Users register, view current and historical
National Bank of Poland (NBP) exchange rates, add *simulated* funds and buy or sell currencies
with virtual money across multiple currency wallets. The course focus is reliable behaviour on
unreliable mobile networks: timeouts, safe retries, offline cache, reconnection and protection
against duplicate data-changing requests.

## Technology choices

The course handbook gives framework and database examples, not mandatory technologies.
This team selected:

| Layer | Choice |
|---|---|
| Mobile client | React Native with Expo (TypeScript) |
| Web service | Java 21, Spring Boot 3 (REST/JSON) |
| Database | PostgreSQL 16, schema migrations with Flyway |
| External data | NBP Web API (`https://api.nbp.pl`), exchange-rate table C |
| Version control | Git, GitHub (private repository) |

## Repository layout

```
docs/      design documentation per milestone (M1: analysis & design)
mobile/    Expo client (implementation starts in Week 6)
backend/   Spring Boot web service (implementation starts in Week 5)
```

## Status

| Milestone | Teaching-week checkpoint | Status |
|---|---|---|
| M1 — Analysis & Design | after Week 4 | in progress |
| M2 — Working client/server prototype | after Week 8 | not started |
| M3 — Network-resilient application | after Week 13 | not started |
| M4 — Final system and presentation | after Week 15 | not started |
