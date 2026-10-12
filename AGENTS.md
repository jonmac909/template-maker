# Hosting and release policy

Hosting: Cloudflare only. Never Vercel or Netlify.

Use the Docker gate (`docker build -f Dockerfile.gate .`), a PR and verified
green checks. Do not use GitHub Actions for releases. Deploy only tested merged
source through the existing Cloudflare project and verify the exact commit live.
This Next.js SSR application requires `@opennextjs/cloudflare` for a future
Cloudflare Workers migration; a passing Next.js build alone does not prove
Workers compatibility or a working production deployment.

JON-24 repository configuration cleanup does not deploy application assets,
change domains, read or alter application secrets, or invoke paid analysis jobs.
Do not run extraction/analysis diagnostic scripts without separate authorization.
Use headless browsers. Before driving Jon's visible Chrome or focusing a window,
run `python C:/Users/partn/my-agent/tools/gaming_mode.py wait`.
