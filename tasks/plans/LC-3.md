# LC-3: Replace Puppeteer with Native PDF Library

**Impact:** Eliminates 200-400MB peak RAM from headless Chromium.
**Effort:** High (rewrite PDF generation)
**Risk:** Medium. PDF layout must match current output.

## Done When
- [ ] PDF generation uses pdfkit or @react-pdf/renderer
- [ ] Output matches current Chromium-rendered quality
- [ ] Puppeteer dependency removed
