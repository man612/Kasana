# Option B — protecting authenticated API responses from HTTP caches

**Status:** Source-level defense-in-depth candidate for review, not a Cloudflare configuration or permission to deploy. Baseline: PR #10 `be19dafa06263f152c5feed13152cf6d86fa1f86`.

## Verified source finding and change

The Lajur. Nginx same-origin proxy dynamically forwards `/api/` to Express. Before this change it had no shared API no-store default, and `getAttachmentFileController` returned `private, max-age=3600` for protected finance attachments. `getLogoImageController` returned `private, max-age=31536000, immutable` for signed-in images. Those directives prevent **compliant shared-cache storage** but still permit browser caching; a misconfigured edge rule overriding response TTL is a separate risk.

The new `privateApiCacheMiddleware` sets `Cache-Control: private, no-store`, `CDN-Cache-Control: no-store` and `Cloudflare-CDN-Cache-Control: no-store` for exact `/api/v1` and descendants, including Better Auth, financial JSON, downloads and error responses. It is registered before all API/auth routes. The two controllers that previously overrode `Cache-Control` now use `private, no-store`. Public `/.well-known/` discovery, `/health`, SPA pages, and static hashed assets are outside this API path and keep their existing cache policy.

This avoids intentional storage by **compliant HTTP caches**, not application-managed Cache API/IndexedDB, reverse proxies configured to ignore headers, browser screenshots, malicious intermediaries or other endpoints. HTTP `no-store` does not invalidate previously cached responses. File downloads still reach users' devices.

Backend unit tests exercise real Express responses, including an auth error, transaction JSON, a synthetic PDF, and public routes; a source-level CI guard prevents regression in the generated Nginx proxy and authenticated image/attachment cache overrides. The synthetic PDF is not a real financial attachment.

## Required Cloudflare Cache Rule before public signups

Create a **Cache Rule with Bypass cache** for the specific public hostname and application API prefix; do **not** use Cache Everything or an Edge Cache TTL override on the app's authenticated pages.

One example Cloudflare Rules expression with a placeholder domain (replace with your actual authorized hostname):

```text
(http.host eq "finance.example.org" and
 (http.request.uri.path eq "/api/v1" or
  starts_with(http.request.uri.path, "/api/v1/")))
```

Set its action to **Bypass cache** and verify its order relative to other matching Cache Rules: Cloudflare applies multiple matching rules in order, and the **last matching conflicting action wins**. Prefer a clear allowlist of static hashed assets for caching over globally enabling caching for all HTML/API content.

At actual deployment, using synthetic accounts only:
1. Confirm `/api/v1/auth/get-session`, `/api/v1/transactions` and authenticated attachment downloads return `Cache-Control: private, no-store`; check the CDN-specific no-store headers as well.
2. Confirm `CF-Cache-Status` is `DYNAMIC` or `BYPASS` for those API routes on repeated requests. A `MISS` alone is not proof: a later request can still be cached. Check in at least two sessions with different authorized users and no real financial data.
3. Verify the dynamic SPA shell and login/reset pages stay uncached, while versioned CSS/JS remains eligible for safe static caching.
4. Verify every applicable Cloudflare rule with the Rules Simulator and inspect header behavior; a custom Edge TTL can override origin `no-store`.
5. If an earlier misconfiguration stored an authenticated response, explicitly purge the affected cache and re-verify. New `no-store` headers cannot cause an already-cached object to be replaced automatically.
6. Inspect Worker Cache API/service-worker/offline behavior if used: this policy is for HTTP caches and **does not** control application-managed storage.
7. Do not leak real bearer tokens/cookies into CLI transcripts, public build artifacts, third-party monitors or issue attachments.

The middleware has no authorization effect: **server-side owner/viewer access control remains mandatory**. This is also not evidence of actual Cloudflare account configuration or live devices. No user secrets or cloud resources were accessed.

## Authoritative references

- [RFC 9111, response no-store/private](https://datatracker.ietf.org/doc/html/rfc9111#section-5.2.2.5)
- [OWASP REST Security — HTTP response headers](https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html)
- [OWASP HTTP Headers — Cache-Control](https://cheatsheetseries.owasp.org/cheatsheets/HTTP_Headers_Cheat_Sheet.html)
- [Cloudflare default cache behavior](https://developers.cloudflare.com/cache/concepts/default-cache-behavior/)
- [Cloudflare dynamic-content/login issues](https://developers.cloudflare.com/cache/troubleshooting/dynamic-content-and-login-issues/)
- [Cloudflare Cache Rule order](https://developers.cloudflare.com/cache/how-to/cache-rules/order/)
- [Cloudflare cache responses and CDN-specific headers](https://developers.cloudflare.com/cache/concepts/cache-responses/)
- [MDN — no-store and existing cached responses](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Caching)
