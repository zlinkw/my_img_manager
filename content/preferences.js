var PdfImageSaverPreferences = {
  PREF_PREFIX: "extensions.pdfImageSaver.",
  QUALITY: {
    low: { label: "Low", estimate: "20-80 KB/image" },
    medium: { label: "Medium", estimate: "60-220 KB/image" },
    high: { label: "High", estimate: "180-750 KB/image" },
  },

  init() {
    const doc = document;
    this.injectStyle(doc);
    this.bindStatusControls(doc);
    this.renderStatus(doc);
  },

  injectStyle(doc) {
    const style = doc.createElement("style");
    style.textContent = `
      .pdf-image-saver-prefs-grid {
        display: grid;
        grid-template-columns: minmax(160px, 240px) minmax(220px, 1fr);
        gap: 8px 12px;
        align-items: center;
      }
      .pdf-image-saver-prefs-grid input[type="text"],
      .pdf-image-saver-prefs-grid input[type="number"],
      .pdf-image-saver-prefs-grid select {
        width: min(420px, 100%);
      }
      #pdf-image-saver-prefs-status {
        color: #555;
        line-height: 1.45;
        max-width: 760px;
      }
    `;
    doc.documentElement.appendChild(style);
  },

  bindStatusControls(doc) {
    for (const id of [
      "pdf-image-saver-default-quality",
      "pdf-image-saver-duplicate-guard",
      "pdf-image-saver-auto-max-images",
      "pdf-image-saver-auto-max-preview-mb",
      "pdf-image-saver-max-index-mb",
    ]) {
      const control = doc.getElementById(id);
      if (!control || typeof control.addEventListener !== "function") {
        continue;
      }
      control.addEventListener("input", () => this.renderStatus(doc));
      control.addEventListener("change", () => this.renderStatus(doc));
    }
  },

  renderStatus(doc = document) {
    const status = doc.getElementById("pdf-image-saver-prefs-status");
    if (!status) {
      return;
    }
    const quality = this.getPreviewQuality(doc);
    const duplicateGuard = this.getControlBool(doc, "pdf-image-saver-duplicate-guard", this.getBoolPref("duplicateGuard", true));
    const autoMaxImages = this.getAutoMaxImages(doc);
    const autoCapMB = this.getAutoMaxPreviewMB(doc);
    const indexCapMB = this.getMaxIndexMB(doc);
    status.textContent = [
      "Storage mode: compact Zotero HTML preview indexes that follow attachment sync.",
      `Preview quality: ${quality.label}, ${quality.estimate}.`,
      `Duplicate guard: ${duplicateGuard ? "on; skips session memory and existing synced HTML indexes" : "off"}.`,
      `Auto page limit: up to ${autoMaxImages} candidates.`,
      `Auto preview cap: ${autoCapMB} MB.`,
      `Synced HTML index cap: ${indexCapMB} MB.`,
      "Optional original extraction stays separate and may need Python/PyMuPDF.",
    ].join(" ");
  },

  getPreviewQuality(doc) {
    const key = this.normalizeQualityKey(
      this.getControlText(doc, "pdf-image-saver-default-quality")
      || this.getTextPref("defaultQuality", "medium"),
    );
    return this.QUALITY[key];
  },

  normalizeQualityKey(value) {
    const key = String(value || "").trim().toLowerCase();
    return Object.prototype.hasOwnProperty.call(this.QUALITY, key) ? key : "medium";
  },

  getAutoMaxImages(doc) {
    return this.getClampedNumber(doc, "pdf-image-saver-auto-max-images", this.getPref("autoDetectMaxImages", 8), 1, 50);
  },

  getAutoMaxPreviewMB(doc) {
    return this.getClampedNumber(doc, "pdf-image-saver-auto-max-preview-mb", this.getPref("autoMaxPreviewBytesMB", 4), 0.5, 8, 1);
  },

  getMaxIndexMB(doc) {
    return this.getClampedNumber(doc, "pdf-image-saver-max-index-mb", this.getPref("maxIndexBytesMB", 6), 1, 12, 1);
  },

  getClampedNumber(doc, id, fallback, min, max, decimals = 0) {
    const control = doc.getElementById(id);
    const controlValue = Number(control?.value);
    const value = Number.isFinite(controlValue) && controlValue > 0 ? controlValue : Number(fallback);
    const clamped = Math.min(Math.max(Number.isFinite(value) ? value : min, min), max);
    return decimals > 0 ? Number(clamped.toFixed(decimals)) : Math.round(clamped);
  },

  getTextPref(name, fallback) {
    const value = this.getPref(name, fallback);
    return typeof value === "string" ? value.trim() : fallback;
  },

  getBoolPref(name, fallback) {
    const value = this.getPref(name, fallback);
    return typeof value === "boolean" ? value : fallback;
  },

  getPref(name, fallback) {
    try {
      const zotero = typeof Zotero !== "undefined" ? Zotero : null;
      const value = zotero?.Prefs?.get?.(`${this.PREF_PREFIX}${name}`);
      return value === undefined || value === null ? fallback : value;
    } catch (_error) {
      return fallback;
    }
  },

  getControlText(doc, id) {
    const control = doc.getElementById(id);
    return typeof control?.value === "string" ? control.value.trim() : "";
  },

  getControlBool(doc, id, fallback) {
    const control = doc.getElementById(id);
    return typeof control?.checked === "boolean" ? control.checked : fallback;
  },
};
