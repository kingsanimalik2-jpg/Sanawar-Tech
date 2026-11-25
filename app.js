const input = document.getElementById("urlInput");
const button = document.getElementById("downloadBtn");
const paste = document.getElementById("pasteBtn");
const message = document.getElementById("message");
const card = document.querySelector(".download-card");

document.getElementById("year").textContent = new Date().getFullYear();

const HISTORY_KEY = "sanawar_downloader_history_v2";
let previewUrl = null;

function showMessage(text, type = "info") {
  message.textContent = text;
  message.className = `message show ${type}`;
}

function setBusy(busy) {
  button.disabled = busy;
  button.innerHTML = busy
    ? "<span>◌</span> PROCESSING..."
    : "<span>↓</span> DOWNLOAD";
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) return "Unknown size";
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let unit = units[0];
  for (let i = 1; value >= 1024 && i < units.length; i++) {
    value /= 1024;
    unit = units[i];
  }
  return `${value.toFixed(2)} ${unit}`;
}

function readHistory() {
  try {
    const value = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function saveHistory(item) {
  const history = [item, ...readHistory()].slice(0, 8);
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  } catch {}
  renderHistory();
}

function renderHistory() {
  const list = document.getElementById("downloadHistoryList");
  if (!list) return;
  const history = readHistory();
  list.replaceChildren();

  if (!history.length) {
    const empty = document.createElement("p");
    empty.className = "sd-empty";
    empty.textContent = "Your recent downloads will appear here.";
    list.appendChild(empty);
    return;
  }

  history.forEach(item => {
    const row = document.createElement("div");
    row.className = "sd-history-row";

    const info = document.createElement("div");
    info.className = "sd-history-info";

    const name = document.createElement("strong");
    name.textContent = item.name || "sanawar-download";

    const meta = document.createElement("small");
    meta.textContent = `${item.size || "Unknown size"} · ${item.type || "Media"} · ${item.date || ""}`;

    info.append(name, meta);
    row.append(info);
    list.appendChild(row);
  });
}

function addV2Panels() {
  if (!card || document.getElementById("sd-progress-wrap")) return;

  const style = document.createElement("style");
  style.textContent = `
    .sd-progress-wrap{display:none;text-align:left;margin:14px 2px 0;padding:13px;background:#081321;border:1px solid #1b3857;border-radius:12px}
    .sd-progress-top{display:flex;justify-content:space-between;gap:12px;color:#d8eaff;font-size:11px;font-weight:700;margin-bottom:9px}
    .sd-progress-track{height:8px;background:#1b2b40;border-radius:20px;overflow:hidden}
    .sd-progress-fill{height:100%;width:0;background:linear-gradient(90deg,#0878f9,#16d2f5);border-radius:20px;transition:width .15s}
    .sd-preview{display:none;margin:14px 2px 0;padding:13px;text-align:left;background:#0a1726;border:1px solid #1b3857;border-radius:12px}
    .sd-preview video,.sd-preview audio{display:block;width:100%;max-height:260px;margin:10px 0;border-radius:9px}
    .sd-preview strong{display:block;color:#eaf5ff;font-size:12px;overflow-wrap:anywhere}
    .sd-preview small{display:block;color:#8fa7c1;font-size:10px;margin-top:5px}
    .sd-history{max-width:720px;margin:28px auto 0;padding:16px;background:#0b1422;border:1px solid #1b2d44;border-radius:14px;text-align:left}
    .sd-history-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:10px}
    .sd-history-head h3{font-size:13px;margin:0;color:#eaf5ff}
    .sd-clear{border:1px solid #29445f;background:#11243a;color:#9bd8ff;border-radius:7px;padding:7px 10px;font-size:10px;font-weight:700}
    .sd-history-row{padding:10px 0;border-top:1px solid #1a2b40}
    .sd-history-info strong{display:block;color:#e3efff;font-size:11px;overflow-wrap:anywhere}
    .sd-history-info small,.sd-empty{display:block;color:#8196b0;font-size:10px;margin-top:5px}
    .sd-v2-note{color:#7890aa;font-size:10px;line-height:1.6;margin:10px 2px 0}
  `;
  document.head.appendChild(style);

  const progress = document.createElement("div");
  progress.id = "sd-progress-wrap";
  progress.className = "sd-progress-wrap";
  progress.innerHTML = `
    <div class="sd-progress-top"><span id="sd-progress-label">Preparing download…</span><span id="sd-progress-percent">0%</span></div>
    <div class="sd-progress-track"><div id="sd-progress-fill" class="sd-progress-fill"></div></div>
  `;

  const preview = document.createElement("div");
  preview.id = "sd-preview";
  preview.className = "sd-preview";

  const note = document.createElement("p");
  note.className = "sd-v2-note";
  note.textContent = "V2: live download progress, media preview and recent-download history. Only public direct media links you own or are authorized to save are supported.";

  message.insertAdjacentElement("afterend", progress);
  progress.insertAdjacentElement("afterend", preview);
  preview.insertAdjacentElement("afterend", note);

  const history = document.createElement("section");
  history.className = "sd-history";
  history.innerHTML = `
    <div class="sd-history-head">
      <h3>RECENT DOWNLOADS</h3>
      <button class="sd-clear" id="sd-clear-history" type="button">CLEAR HISTORY</button>
    </div>
    <div id="downloadHistoryList"></div>
  `;
  card.insertAdjacentElement("afterend", history);

  document.getElementById("sd-clear-history").addEventListener("click", () => {
    try { localStorage.removeItem(HISTORY_KEY); } catch {}
    renderHistory();
  });

  renderHistory();
}

function updateProgress(loaded, total) {
  const wrap = document.getElementById("sd-progress-wrap");
  const fill = document.getElementById("sd-progress-fill");
  const label = document.getElementById("sd-progress-label");
  const percent = document.getElementById("sd-progress-percent");
  wrap.style.display = "block";

  if (total > 0) {
    const value = Math.min(100, Math.round((loaded / total) * 100));
    fill.style.width = `${value}%`;
    percent.textContent = `${value}%`;
    label.textContent = `${formatBytes(loaded)} of ${formatBytes(total)}`;
  } else {
    fill.style.width = "35%";
    percent.textContent = formatBytes(loaded);
    label.textContent = "Downloading…";
  }
}

function safeFilenameFromHeader(header) {
  const match = (header || "").match(/filename="([^"]+)"/i);
  return match ? match[1] : "sanawar-download";
}

async function readJsonResponse(response) {
  const text = await response.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    throw new Error("Server returned an unexpected response. Please retry or contact the site owner.");
  }
}

paste.addEventListener("click", async () => {
  try {
    input.value = await navigator.clipboard.readText();
    showMessage("Link pasted. Press DOWNLOAD to check it.", "info");
  } catch {
    input.focus();
    showMessage("Clipboard access is unavailable. Long-press the field and choose Paste.", "info");
  }
});

button.addEventListener("click", async () => {
  const url = input.value.trim();
  if (!url) {
    showMessage("Please paste a video or audio URL first.", "error");
    return;
  }

  setBusy(true);
  const progress = document.getElementById("sd-progress-wrap");
  const preview = document.getElementById("sd-preview");
  progress.style.display = "none";
  preview.style.display = "none";
  if (previewUrl) {
    URL.revokeObjectURL(previewUrl);
    previewUrl = null;
  }
  showMessage("Checking your link…", "info");

  try {
    const inspect = await fetch("/api/inspect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url })
    });

    const details = await readJsonResponse(inspect);
    if (!inspect.ok) throw new Error(details.error || "Could not check this URL.");
    if (details.kind === "platform") throw new Error(details.message);

    showMessage("Direct media link detected. Starting download…", "info");

    const response = await fetch("/api/download", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url })
    });

    if (!response.ok) {
      const data = await readJsonResponse(response).catch(error => ({ error: error.message }));
      throw new Error(data.error || "Download failed.");
    }

    const total = Number(response.headers.get("content-length") || 0);
    const type = response.headers.get("content-type") || "application/octet-stream";
    const filename = safeFilenameFromHeader(response.headers.get("content-disposition"));
    const reader = response.body.getReader();
    const chunks = [];
    let loaded = 0;

    updateProgress(0, total);
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      loaded += value.byteLength;
      updateProgress(loaded, total);
    }

    const blob = new Blob(chunks, { type });
    previewUrl = URL.createObjectURL(blob);

    const anchor = document.createElement("a");
    anchor.href = previewUrl;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();

    const previewBox = document.getElementById("sd-preview");
    previewBox.replaceChildren();

    const title = document.createElement("strong");
    title.textContent = filename;
    const meta = document.createElement("small");
    meta.textContent = `${formatBytes(blob.size)} · ${type}`;
    previewBox.append(title, meta);

    if (type.startsWith("video/")) {
      const video = document.createElement("video");
      video.controls = true;
      video.src = previewUrl;
      previewBox.appendChild(video);
    } else if (type.startsWith("audio/")) {
      const audio = document.createElement("audio");
      audio.controls = true;
      audio.src = previewUrl;
      previewBox.appendChild(audio);
    }

    previewBox.style.display = "block";
    saveHistory({
      name: filename,
      size: formatBytes(blob.size),
      type: type.split(";")[0],
      date: new Date().toLocaleString()
    });

    showMessage("Download ready! Check your device's Downloads folder.", "success");
  } catch (error) {
    showMessage(error.message || "Something went wrong.", "error");
  } finally {
    setBusy(false);
  }
});

input.addEventListener("keydown", event => {
  if (event.key === "Enter") button.click();
});

addV2Panels();
