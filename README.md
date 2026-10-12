# Template Maker

Hosting: Cloudflare only. Never Vercel or Netlify.

JON-24 repository cleanup uses `docker build -f Dockerfile.gate .`, a PR and
a verified green `docker/cloudflare` commit status. The gate installs locked
dependencies, validates diagnostic script syntax, runs the existing Next.js
production build (including its TypeScript check), and proves build artifacts
exist. Build checks have no network access; environment files are excluded.
Do not use GitHub Actions for releases.

The former hosting file's 120-second API limit is preserved in standard Next.js
route exports. The Docker gate checks the generated function manifest so removing
the obsolete file does not silently lose that setting on the retained old host.

This configuration cleanup does not migrate or deploy the Next.js application.
A future Cloudflare Workers deployment requires `@opennextjs/cloudflare`, an
approved environment and full browser/API/auth verification. Follow AGENTS.md
and CLAUDE.md; never equate a git push or successful Next.js build with a live
Cloudflare application deployment.

Existing browser diagnostics require `TARGET_URL` pointing to the approved
Cloudflare deployment or local development URL; they have no old-host default.
Extraction/analysis scripts can invoke paid providers and require separate
authorization. JON-24 validates their syntax without executing them.
