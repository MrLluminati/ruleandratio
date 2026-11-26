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
