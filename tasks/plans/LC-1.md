# LC-1: Upgrade to e2-small

**Impact:** Doubles RAM (2GB) and CPU baseline (0.50 vCPU). Eliminates memory pressure.
**Effort:** Low (GCP console)
**Cost:** ~$13/month
**Risk:** Low. Same machine family, just bigger.

## Done When
- [ ] Instance resized to e2-small
- [ ] PM2 and PostgreSQL configs updated for 2GB RAM
- [ ] Application verified working after resize
