# SANAWAR DOWNLOADER

Premium black + blue downloader website starter built with Node.js + Express.

## What works
- Responsive black/blue frontend.
- Detects TikTok, Facebook, YouTube, Instagram, X, Pinterest, Reddit, Vimeo, Threads and Snapchat URLs.
- Downloads public direct video/audio file URLs (for content the user owns or is authorized to save).
- Server-side file type validation, size limit, rate limiting, security headers and basic SSRF protections.
- No database or API key required for the direct-media mode.

## Important platform limitation
Social-platform page URLs are detected but are **not scraped or extracted**. Many platforms restrict automated downloading, watermark removal, or access to private/DRM-protected media. Do not add a scraper or bypass protections. To support a platform, implement its official API/export flow and comply with its terms, creator permissions, and applicable law. Do not promise "no watermark" unless the authorized source itself provides a watermark-free file.

## Requirements
- Node.js 20 or newer
- npm

## Run locally
```bash
npm install
cp .env.example .env
npm start
```
Open http://localhost:3000

On Windows, copy `.env.example` to `.env` manually if `cp` is unavailable.

## Configuration
- `PORT`: server port (default 3000)
- `MAX_DOWNLOAD_MB`: maximum media size (default 150)
- `RATE_LIMIT_WINDOW_MS`: API rate-limit window (default 60000)
- `RATE_LIMIT_MAX`: requests per window per IP (default 20)

## Deployment
Deploy to a Node.js host that supports long-running Express apps. Set the start command to `npm start`, use Node 20+, and configure environment variables. Use HTTPS in production. Do not deploy behind a proxy unless the host's trusted-proxy configuration is understood and configured correctly.

## Production hardening before public launch
- Add a persistent job queue and storage if you need large files or concurrent downloads.
- Pin outbound DNS resolution at connection time and add egress firewall rules; DNS checks alone are not a complete SSRF defense.
- Add request timeouts, monitoring, abuse reporting, and stricter per-user quotas.
- Review platform API terms and privacy obligations before adding integrations.
- Consider streaming downloads through object storage rather than keeping large transfers open through the web process.

## API
- `GET /api/health`
- `POST /api/inspect` with `{ "url": "https://..." }`
- `POST /api/download` with `{ "url": "https://...", "filename": "my-video.mp4" }`


## Deploy on Vercel (Android + GitHub)
This project is configured for Vercel's Express support:
- `server.js` exports the Express app.
- Files in `public/` are served by Vercel's static CDN.
- Import the GitHub repository at https://vercel.com/new.
- Framework preset: Other (or let Vercel detect Express).
- Build command: leave blank.
- Output directory: leave blank.
- Install command: `npm install` (or leave default).
- Deploy, then test `/api/health`.

Vercel's free Hobby plan has usage limits and is intended for personal/non-commercial use. Function execution limits apply, so this starter is best for testing and modest direct-media downloads. Large/long-running media transfers may exceed serverless limits.
