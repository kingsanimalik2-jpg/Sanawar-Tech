const express = require("express");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const dns = require("node:dns").promises;
const net = require("node:net");
const ipaddr = require("ipaddr.js");
const path = require("node:path");

const app = express();
const PORT = Number(process.env.PORT || 3000);
const MAX_BYTES = Number(process.env.MAX_DOWNLOAD_MB || 150) * 1024 * 1024;

app.disable("x-powered-by");
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:"],
      mediaSrc: ["'self'", "blob:"],
      connectSrc: ["'self'"],
      frameAncestors: ["'none'"]
    }
  }
}));
app.use(express.json({ limit: "10kb" }));
// Vercel serves files in /public from its static CDN.
app.use("/api/", rateLimit({
  windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS || 60000),
  limit: Number(process.env.RATE_LIMIT_MAX || 20),
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Too many requests. Please wait a minute and try again." }
}));

const platformHosts = [
  { name: "TikTok", hosts: ["tiktok.com", "www.tiktok.com", "vm.tiktok.com"] },
  { name: "Facebook", hosts: ["facebook.com", "www.facebook.com", "fb.watch", "m.facebook.com"] },
  { name: "YouTube", hosts: ["youtube.com", "www.youtube.com", "youtu.be", "m.youtube.com"] },
  { name: "Instagram", hosts: ["instagram.com", "www.instagram.com"] },
  { name: "X", hosts: ["x.com", "www.x.com", "twitter.com", "www.twitter.com"] },
  { name: "Pinterest", hosts: ["pinterest.com", "www.pinterest.com", "pin.it"] },
  { name: "Reddit", hosts: ["reddit.com", "www.reddit.com", "redd.it"] },
  { name: "Vimeo", hosts: ["vimeo.com", "www.vimeo.com", "player.vimeo.com"] },
  { name: "Threads", hosts: ["threads.net", "www.threads.net"] },
  { name: "Snapchat", hosts: ["snapchat.com", "www.snapchat.com"] }
];

function detectPlatform(host) {
  return platformHosts.find(p => p.hosts.includes(host))?.name || null;
}
function isPublicAddress(address) {
  if (!ipaddr.isValid(address)) return false;
  const parsed = ipaddr.parse(address);
  return parsed.range() === "unicast";
}
async function assertPublicHost(hostname) {
  if (hostname === "localhost" || hostname.endsWith(".local")) throw new Error("Local network URLs are not allowed.");
  const records = await dns.lookup(hostname, { all: true, verbatim: true });
  if (!records.length || records.some(r => !isPublicAddress(r.address))) {
    throw new Error("This host is not publicly routable.");
  }
}
function safeFilename(value, fallback = "sanawar-media") {
  return String(value || fallback).replace(/[^a-z0-9._-]/gi, "_").slice(0, 90) || fallback;
}
function parseHttpUrl(raw) {
  let u;
  try { u = new URL(raw); } catch { throw new Error("Please enter a valid URL."); }
  if (!["https:", "http:"].includes(u.protocol)) throw new Error("Only HTTP and HTTPS links are supported.");
  if (u.username || u.password) throw new Error("URLs containing login credentials are not allowed.");
  if (u.port && !["80", "443"].includes(u.port)) throw new Error("Custom ports are not allowed.");
  return u;
}

app.get("/api/health", (_req, res) => res.json({ ok: true, name: "SANAWAR DOWNLOADER", mode: "authorized-direct-media" }));

app.post("/api/inspect", (req, res) => {
  try {
    const url = parseHttpUrl(req.body?.url || "");
    const platform = detectPlatform(url.hostname.toLowerCase());
    if (platform) {
      return res.json({
        kind: "platform",
        platform,
        supported: false,
        message: `${platform} link detected. This starter does not extract media from social-platform pages. Use the platform's official download/export feature or connect an authorized API integration.`
      });
    }
    res.json({
      kind: "direct",
      platform: null,
      supported: true,
      message: "Direct media link detected. If the URL points to a public video or audio file that you own or are authorized to download, you can continue."
    });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.post("/api/download", async (req, res) => {
  let upstream;
  try {
    const url = parseHttpUrl(req.body?.url || "");
    const platform = detectPlatform(url.hostname.toLowerCase());
    if (platform) {
      return res.status(422).json({
        error: `${platform} page downloads are not enabled. This website will not bypass platform restrictions, private content, DRM, or watermark protections. Use an official export/download option or an authorized integration.`
      });
    }

    await assertPublicHost(url.hostname);
    upstream = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(25000), headers: { "User-Agent": "SANAWAR-DOWNLOADER/1.0" } });

    // Redirects are deliberately not followed automatically; validate the destination on a new request.
    if (upstream.status >= 300 && upstream.status < 400) {
      const location = upstream.headers.get("location");
      return res.status(422).json({ error: "This media host redirected the request. For safety, use the final direct media URL instead.", redirect: location || undefined });
    }
    if (!upstream.ok) return res.status(502).json({ error: `Media host returned HTTP ${upstream.status}.` });

    const type = (upstream.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
    const allowed = type.startsWith("video/") || type.startsWith("audio/") || type === "application/octet-stream";
    if (!allowed) return res.status(415).json({ error: "The link does not appear to point directly to a video or audio file." });

    const length = Number(upstream.headers.get("content-length") || 0);
    if (length > MAX_BYTES) return res.status(413).json({ error: `File exceeds the ${Math.round(MAX_BYTES / 1024 / 1024)} MB limit.` });
    if (!upstream.body) return res.status(502).json({ error: "The media host returned an empty response." });

    const extByType = {
      "video/mp4": "mp4", "video/webm": "webm", "video/quicktime": "mov",
      "audio/mpeg": "mp3", "audio/mp4": "m4a", "audio/ogg": "ogg", "audio/wav": "wav"
    };
    const ext = extByType[type] || (type.startsWith("audio/") ? "audio" : "mp4");
    const name = safeFilename(req.body?.filename || `sanawar-download.${ext}`);
    res.setHeader("Content-Type", type);
    res.setHeader("Content-Disposition", `attachment; filename="${name.includes(".") ? name : `${name}.${ext}`}"`);
    res.setHeader("X-Content-Type-Options", "nosniff");

    const reader = upstream.body.getReader();
    let total = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_BYTES) {
        await reader.cancel();
        if (!res.headersSent) res.status(413).json({ error: "File exceeded the download limit." });
        else res.destroy();
        return;
      }
      if (!res.write(Buffer.from(value))) await new Promise(resolve => res.once("drain", resolve));
    }
    res.end();
  } catch (e) {
    if (!res.headersSent) res.status(400).json({ error: e.name === "TimeoutError" ? "The media host took too long to respond." : e.message || "Download failed." });
    else res.destroy();
  }
});

app.get("*", (_req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));
module.exports = app;
