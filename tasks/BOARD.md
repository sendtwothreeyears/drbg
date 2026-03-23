# Assessment Performance Optimization — Task Board

> Source: `docs/experts/consensus-assessment-performance.md` (2026-03-23)

## Statuses
- `backlog` — not started
- `in_progress` — actively being worked on
- `review` — done, awaiting user review
- `done` — accepted
- `blocked` — waiting on something

---

## Quick Wins (Free Code Changes)

| ID | Task | Status | Plan |
|----|------|--------|------|
| QW-1 | Create IVFFlat index on guideline_chunks.embedding | done | [plan](plans/QW-1.md) |
| QW-2 | Parallelize extractFindings with assessment pipeline | done | [plan](plans/QW-2.md) |
| QW-3 | Parallelize embedding calls in searchGuidelines | done | [plan](plans/QW-3.md) |
| QW-4 | Add timeouts to all external API calls | done | [plan](plans/QW-4.md) |
| QW-5 | Set Node.js memory limit + PM2 restart policy | done | [plan](plans/QW-5.md) |
| QW-6 | Reduce pg.Pool connections + add pool config | done | [plan](plans/QW-6.md) |

## Medium Effort

| ID | Task | Status | Plan |
|----|------|--------|------|
| ME-1 | Stream Claude Sonnet assessment to client | done | [plan](plans/ME-1.md) |
| ME-2 | Add embedding cache | done | [plan](plans/ME-2.md) |
| ME-3 | Add guideline result cache | done | [plan](plans/ME-3.md) |
| ME-4 | PostgreSQL tuning | done | [plan](plans/ME-4.md) |
| ME-5 | Nginx config hardening | done | [plan](plans/ME-5.md) |
| ME-6 | Batch embedding calls | done | [plan](plans/ME-6.md) |

## Larger Changes

| ID | Task | Status | Plan |
|----|------|--------|------|
| LC-1 | Upgrade to e2-small | backlog (manual) | [plan](plans/LC-1.md) |
| LC-2 | Switch to SSD persistent disk | backlog (manual) | [plan](plans/LC-2.md) |
| LC-3 | Replace Puppeteer with native PDF lib | backlog (high effort) | [plan](plans/LC-3.md) |
| LC-4 | Deduplicate SDK client instances | done | [plan](plans/LC-4.md) |
| LC-5 | Pre-compile TypeScript for production | blocked | [plan](plans/LC-5.md) |
| LC-6 | Reduce embedding dimensions to 512 | backlog (requires re-embed) | [plan](plans/LC-6.md) |
