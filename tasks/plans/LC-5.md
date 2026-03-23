# LC-5: Pre-compile TypeScript for Production

**Impact:** Saves ~30-50MB memory, faster cold start.
**Effort:** Medium
**Risk:** Low. Source maps for debugging.

## Changes
- Add esbuild/tsc build step
- Update `ecosystem.config.cjs` to run `dist/server/main.js` with plain `node`
- Add `--sourcemap` for debugging

## Done When
- [ ] Production runs compiled JS, not tsx
- [ ] Build step in deploy script
- [ ] Source maps available for debugging
