# Cloudflare Pages

Connect the GitHub repository to a Cloudflare Pages project using Workers & Pages -> Create application -> Pages -> Import an existing Git repository.

- Production branch: main
- Framework: Astro
- Build command: npm run build
- Output directory: dist
- Node version: 22 (22.12+)
- Root directory: repository root

Use the generated pages.dev URL for pre-launch testing. Keep noindex until the release checklist is satisfied. Once the actual domain is registered, attach it via the Pages custom domain settings and configure DNS. Never commit credentials. This repository does not create the Cloudflare project or configure DNS automatically.

Reference: https://developers.cloudflare.com/pages/framework-guides/deploy-an-astro-site/

## Search and SEO build settings
The build command includes Astro, Pagefind and SEO validation. Leave PUBLIC_RR_INDEXING unset/false for previews. Set PUBLIC_RR_SITE_URL only to the confirmed production HTTPS origin, and enable indexing only after explicit approval and launch review. See docs/search-seo.md. Preview environments must never inherit the production indexing flag.

## RR-014 preview deployment checklist
Create a Pages project named ruleandratio (or an available variation) via Git integration, not a Workers SSR application. Authorize only MrLluminati/ruleandratio. Select main, Astro, npm run build, dist, and the repository root. Set NODE_VERSION=22 and PUBLIC_RR_INDEXING=false in both production and preview environments for now. Leave PUBLIC_RR_SITE_URL unset until the registered domain is confirmed. Use the assigned pages.dev address; do not assume the project name is available. Cloudflare must install dev dependencies because Pagefind and the SEO validator run during build. After CI passes, inspect the deployment log and live homepage, navigation, a knowledge hub, search and a nonexistent route. Check meta robots remains noindex. The live preview is publicly accessible unless access restrictions are enabled; no confidential content should be published. No custom domain or indexing changes before approval.

Dashboard: https://dash.cloudflare.com/
Official Git integration: https://developers.cloudflare.com/pages/get-started/git-integration/
Build configuration: https://developers.cloudflare.com/pages/configuration/build-configuration/
