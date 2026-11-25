const input = document.getElementById("urlInput");
const button = document.getElementById("downloadBtn");
const paste = document.getElementById("pasteBtn");
const message = document.getElementById("message");
document.getElementById("year").textContent = new Date().getFullYear();

function showMessage(text, type = "info") {
  message.textContent = text;
  message.className = `message show ${type}`;
}
function setBusy(busy) {
  button.disabled = busy;
  button.innerHTML = busy ? "<span>◌</span> PROCESSING..." : "<span>↓</span> DOWNLOAD";
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
  if (!url) return showMessage("Please paste a video or audio URL first.", "error");
  setBusy(true);
  showMessage("Checking your link…", "info");
  try {
    const inspect = await fetch("/api/inspect", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url })
    });
    const details = await inspect.json();
    if (!inspect.ok) throw new Error(details.error || "Could not check this URL.");
    if (details.kind === "platform") {
      throw new Error(details.message);
    }
    showMessage("Direct media link detected. Starting download…", "info");
    const response = await fetch("/api/download", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url })
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || "Download failed.");
    }
    const blob = await response.blob();
    const disposition = response.headers.get("content-disposition") || "";
    const match = disposition.match(/filename="([^"]+)"/);
    const filename = match ? match[1] : "sanawar-download";
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = objectUrl; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(objectUrl);
    showMessage("Your download is ready. Check your device's Downloads folder.", "success");
  } catch (error) {
    showMessage(error.message || "Something went wrong.", "error");
  } finally {
    setBusy(false);
  }
});
input.addEventListener("keydown", e => { if (e.key === "Enter") button.click(); });
