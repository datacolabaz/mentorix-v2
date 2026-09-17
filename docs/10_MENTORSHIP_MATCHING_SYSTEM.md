# Matching System

## Product principle

Matching is decision support, not automatic assignment. The mentee sees a small ranked set, “why this matches” explanations, trade-offs and an option to browse all verified offers.

## Intake features

- goal and outcome;
- category/subcategory;
- current level and target level;
- desired date;
- language/session language;
- timezone and availability;
- budget/currency;
- online/offline;
- mentor characteristics;
- format: one-off, recurring or program;
- accessibility/safeguarding needs.

Store the original intake snapshot for explainability and analytics.

## Ranking architecture

### Stage 1: hard eligibility filters
Exclude unavailable, unpublished, unverified or suspended offers; incompatible language, delivery format, age/safety policy, schedule and budget must be respected. Do not use opaque ML to override safety or price constraints.

### Stage 2: deterministic scoring
Weighted features:

- goal/category fit: 30%;
- outcome/program fit: 20%;
- availability/timezone fit: 15%;
- experience/credential fit: 15%;
- budget/format fit: 10%;
- quality signals: 10% (completed sessions, rating with Bayesian smoothing, response/attendance reliability).

Weights are configuration and experiment-controlled, not code constants.

### Stage 3: diversity and fairness
Do not return ten nearly identical mentors. Diversify by price, background, language and approach. Monitor rank exposure by mentor cohort and avoid using protected attributes as a quality proxy.

### Stage 4: explanation
Persist feature contributions and show plain language: “Matches your IELTS speaking goal, has evening availability in your timezone, and offers an 8-week plan.” Never show sensitive internal scores.

## AI-assisted matching

AI may normalize free-text goals, extract skills, propose goal templates, summarize mentor offer fit and generate clarifying questions. It must not make final eligibility decisions, invent credentials or rank protected characteristics. Use structured taxonomy IDs as the source of truth.

Recommended architecture:

1. taxonomy/embedding enrichment job;
2. deterministic eligibility and SQL search;
3. optional vector retrieval for free text;
4. rules-based reranking;
5. human-readable explanation generated from stored facts;
6. feedback loop from clicks, bookings, completions and outcomes.

Start without a vector database if catalog <10k offers; PostgreSQL full-text/normalized tags are sufficient. Add pgvector only after evidence of search quality need.

## Match feedback

Capture `match_impression`, `match_click`, `match_save`, `match_request`, `match_book`, `match_complete`, `match_reject_reason`. Ask “why not this mentor?” sparingly to improve supply and relevance.

## Failure handling

If no exact match exists, show near matches with the violated soft preference and a waitlist. Never recommend unverified mentors just to fill a result set. Human support can manually curate matches for launch.
