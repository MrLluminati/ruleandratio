# Dependency security — 27 November 2026

The Windows audit reported vulnerable Astro 6, esbuild 0.27.7 and sharp 0.34.5. Astro 7.4.13 is the targeted upgrade. No blanket force fix or untested transitive override is applied. The actual resolution is checked by npm audit at low severity on Linux and Windows; if either fails, do not merge. The existing Linux publishing suite exercises static routes, search, draft exclusion and browser tools; Windows checks installation, audit, editorial API and static build. Retain static output and Astro 6 whitespace behavior. The new default Markdown processor and compiler are subject to existing tests and manual visual review.

References: https://docs.astro.build/en/guides/upgrade-to/v7/ ; https://github.com/advisories/GHSA-g7r4-m6w7-qqqr ; https://github.com/advisories/GHSA-wq5f-xc86-pv6w ; https://github.com/advisories/GHSA-26w7-cxv4-gfx2 .

After merge, stop the local CMS, git pull, npm.cmd install, npm.cmd audit, npm.cmd run test:editorial, npm.cmd run build, npm.cmd run editorial:cms. Do not delete review records or local draft changes. Do not expose the development server publicly. A clean audit addresses known reported advisories, not all possible security defects. The repository currently has no tracked lockfile; exact Astro pin plus audit is not a reproducible full dependency lock. No editorial approvals or content are changed.
