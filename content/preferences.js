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
      .pdf-image-saver-prefs-intro {
        margin: 0 0 8px;
        color: #555;
        max-width: 760px;
      }
      .pdf-image-saver-prefs-section {
        margin: 0 0 12px;
        padding: 0 0 10px;
        border-bottom: 1px solid rgba(0, 0, 0, 0.08);
      }
      .pdf-image-saver-prefs-section:last-of-type {
        border-bottom: 0;
        padding-bottom: 0;
      }
      .pdf-image-saver-prefs-section-title {
        margin: 0 0 8px;
        font-size: 13px;
        font-weight: 600;
      }
      .pdf-image-saver-prefs-grid {
        display: grid;
        grid-template-columns: minmax(120px, 160px) minmax(220px, 1fr);
        gap: 8px 12px;
        align-items: center;
      }
      .pdf-image-saver-prefs-grid input[type="text"],
      .pdf-image-saver-prefs-grid input[type="number"],
      .pdf-image-saver-prefs-grid select {
        width: min(420px, 100%);
      }
      .pdf-image-saver-prefs-check {
        display: inline-flex;
        align-items: center;
        gap: 8px;
      }
      .pdf-image-saver-prefs-status {
        max-width: 760px;
        color: #444;
        line-height: 1.4;
        font-size: 12.5px;
        white-space: pre-line;
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
      "Store: HTML indexes (sync with PDF)",
      `Q ${quality.label}; ${this.formatEstimateShort(quality.estimate)}`,
      `Dups: ${duplicateGuard ? "on; session + saved" : "off"}`,
      `Auto: ${autoMaxImages} max; ${autoCapMB} MB`,
      `Index: ${indexCapMB} MB`,
      "Helper: optional originals only",
    ].join("\n");
  },

  formatEstimateShort(estimate) {
    return String(estimate || "").replace(/\/image$/i, "");
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
