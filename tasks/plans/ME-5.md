# ME-5: Nginx Config Hardening

**Impact:** Prevents Nginx killing long SSE connections; minor latency improvement.
**Effort:** Low
**Risk:** Low.

## Changes (`deploy/nginx.conf`)
- Add `proxy_read_timeout 300s` for SSE endpoints
- Add `keepalive 8` to upstream block
- Add `gzip on` for JSON/CSS/JS responses

## Done When
- [ ] Nginx config updated with timeouts
- [ ] Gzip enabled for static assets
