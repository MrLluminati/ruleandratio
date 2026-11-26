# RR-012/013 — Search and SEO

Pagefind indexes built HTML after Astro. Subject hubs, section directories, reviewed articles, acts, provisions and amendments are searchable even in a noindex preview. Drafts never generate pages. Search filters use content type and subject, and support full-text matching of case names, citations, Act names and sections. Search runs locally in the browser using static index files. The site search page is excluded from both Pagefind and Google indexing. Run npm run build then npm run preview to test; Astro dev alone has no Pagefind bundle.

The SEO post-build script validates titles, descriptions, robots tags, self-canonical/OG URL consistency, JSON-LD syntax, and Pagefind output. Canonical URLs are generated only from a confirmed HTTPS production origin; no domain is assumed. XML sitemap and RSS are generated from eligible rendered HTML rather than a second list of URLs. Noindex pages are excluded. RSS contains up to 50 reviewed published articles, not statutory version records. Robots.txt allows crawling so crawlers can read noindex; it advertises a sitemap only on an enabled production build.

## Production environment variables
- PUBLIC_RR_SITE_URL = confirmed HTTPS origin (no path)
- PUBLIC_RR_INDEXING = true ONLY after registration, deployment, content review, launch checklist and explicit approval. Unset/false for all previews. Set these as build environment variables, not secrets. No origin is guessed. With indexing true the build fails unless there is reviewed content eligible for the homepage. Empty subject/section hubs, search, error pages and planned journal/tools are noindex. Do not enable indexing on pages.dev deployments; use separate preview environment variables.

Article JSON-LD uses actual author, publication date and optional substantive modifiedAt. A review date alone does not establish modification. Set authorType to Organization for group bylines. Breadcrumbs are generated for subject and content pages; publisher metadata is limited to known facts. Social sharing title/description/card metadata is included; raster social preview images and per-article illustrations are not yet integrated. Do not claim rich-result eligibility or rankings. Verify production canonicals, Search Console ownership, sitemap and URL inspection after deployment. Review thin or low-value pages before launch.

Official references: https://pagefind.app/docs/ ; https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap ; https://developers.google.com/search/docs/appearance/structured-data/article .

## Verification
CI uses temporary synthetic fixtures to test both preview and enabled-production builds, sitemap/RSS inclusion and exclusion, and a real Chromium browser search with type/subject filters. Fixtures and output are removed before the final preview build. Local browser test: install Chromium via npx playwright install chromium, then set RR_TEST_BROWSER=1 before npm run test:publishing. The tests intentionally restore a noindex preview build, not a production deployment.
