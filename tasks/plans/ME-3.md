# ME-3: Add Guideline Result Cache

**Impact:** Eliminates 500-1100ms for repeated condition+findings combinations.
**Effort:** Low-Medium
**Risk:** Low. Guidelines change infrequently. Use 30-min TTL.

## Changes
- `searchGuidelines.ts`: Cache full search results keyed on `condition + findings` hash
- 30-minute TTL
- Invalidate when embed scripts run

## Done When
- [ ] Search results cached with TTL
- [ ] Cache hit skips embedding + DB query entirely
- [ ] Cache bounded by size or count
