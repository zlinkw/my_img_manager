var PdfImageSaverPreferences = {
  PREF_PREFIX: "extensions.pdfImageSaver.",
  QUALITY: {
    low: { label: "低", mark: "低", estimate: "20-80 KB/张" },
    medium: { label: "中", mark: "中", estimate: "60-220 KB/张" },
    high: { label: "高", mark: "高", estimate: "180-750 KB/张" },
  },
  IMAGE_CATEGORIES: {
    auto: { label: "自动判断（推荐）", mark: "自动" },
    metric_curve: { label: "指标／训练曲线", mark: "曲线" },
    heatmap: { label: "热图／矩阵图", mark: "热图" },
    bar_chart: { label: "柱状／条形图", mark: "柱图" },
    distribution: { label: "分布／降维图", mark: "分布" },
    qualitative: { label: "定性结果对比", mark: "对比" },
    architecture: { label: "网络／模型结构图", mark: "结构" },
    pipeline: { label: "方法流程图", mark: "流程" },
    table: { label: "科研表格", mark: "表格" },
    equation: { label: "公式", mark: "公式" },
    schematic: { label: "装置／原理示意", mark: "示意" },
    photo: { label: "照片／医学影像", mark: "影像" },
    chart: { label: "图表", mark: "图表" },
    diagram: { label: "流程图／示意图", mark: "流程" },
    figure: { label: "其他插图", mark: "插图" },
  },

  init(doc = document) {
    const root = doc.getElementById("pdf-image-saver-preferences");
    if (root?.getAttribute?.("data-pdf-image-saver-ready") === "true") {
      const reopenNotice = this.formatRepairNotice(this.loadControls(doc));
      if (reopenNotice) this.updateSaveNotice(doc, reopenNotice); else this.updateSaveNotice(doc);
      return;
    }
    root?.setAttribute?.("data-pdf-image-saver-ready", "true");
    this.injectStyle(doc);
    const openNotice = this.formatRepairNotice(this.loadControls(doc));
    this.bindControls(doc);
    if (openNotice) this.updateSaveNotice(doc, openNotice); else this.updateSaveNotice(doc);
  },

  injectStyle(doc) {
    const style = doc.createElement("style");
    style.textContent = `
      .pdf-image-saver-prefs-intro {
        margin: 0 0 12px;
        color: #64748B;
        max-width: 720px;
        font-size: 13px;
        line-height: 1.55;
      }
      .pdf-image-saver-prefs-save-notice {
        display: block;
        margin-top: 3px;
        color: #15803D;
        font-weight: 600;
      }
      .pdf-image-saver-prefs-save-notice.is-error {
        color: #DC2626;
      }
      .pdf-image-saver-prefs-section {
        margin: 0 0 16px;
        padding: 0 0 14px;
        border-bottom: 1px solid #CBD5E1;
      }
      .pdf-image-saver-prefs-section:last-child {
        border-bottom: 0;
        padding-bottom: 0;
      }
      .pdf-image-saver-prefs-section-title {
        margin: 0 0 8px;
        font-size: 14px;
        font-weight: 600;
      }
      .pdf-image-saver-prefs-advanced > summary {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        min-height: 32px;
        margin: 0;
        padding: 6px 10px;
        box-sizing: border-box;
        border: 1px solid #64748B;
        border-radius: 6px;
        background: #FFFFFF;
        cursor: pointer;
        list-style: none;
      }
      .pdf-image-saver-prefs-advanced > summary::-webkit-details-marker {
        display: none;
      }
      .pdf-image-saver-prefs-advanced > summary::after {
        content: "展开设置";
        flex: 0 0 auto;
        color: #2563EB;
        font-size: 12px;
        font-weight: 400;
      }
      .pdf-image-saver-prefs-advanced[open] > summary::after {
        content: "收起设置";
      }
      .pdf-image-saver-prefs-summary-note {
        min-width: 0;
        margin-left: auto;
        overflow: hidden;
        color: #64748B;
        font-size: 12px;
        font-weight: 400;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .pdf-image-saver-prefs-advanced-body {
        margin-top: 8px;
      }
      .pdf-image-saver-prefs-list {
        display: grid;
        gap: 10px;
      }
      .pdf-image-saver-prefs-row {
        display: grid;
        grid-template-columns: minmax(150px, 190px) minmax(260px, 420px);
        gap: 3px 12px;
        align-items: center;
        padding: 10px;
        border: 1px solid #CBD5E1;
        background: #F8FAFC;
        border-radius: 8px;
      }
      .pdf-image-saver-prefs-row > label {
        font-weight: 600;
      }
      .pdf-image-saver-prefs-row input[type="text"],
      .pdf-image-saver-prefs-row input[type="number"],
      .pdf-image-saver-prefs-row select,
      .pdf-image-saver-prefs-menu {
        width: min(400px, 100%);
        min-height: 32px;
        box-sizing: border-box;
        border-radius: 6px;
        pointer-events: auto;
        opacity: 1;
      }
      .pdf-image-saver-prefs-python-picker {
        display: flex;
        align-items: center;
        gap: 8px;
        width: min(560px, 100%);
      }
      .pdf-image-saver-prefs-python-picker input[type="text"] {
        flex: 1 1 260px;
        min-width: 160px;
      }
      .pdf-image-saver-prefs-python-picker button {
        flex: 0 0 auto;
        min-height: 32px;
        padding: 6px 10px;
        border-radius: 6px;
        white-space: nowrap;
        cursor: pointer;
      }
      .pdf-image-saver-prefs-row > p {
        grid-column: 2;
        margin: 0;
        color: #64748B;
        font-size: 12px;
        line-height: 1.4;
      }
      .pdf-image-saver-prefs-note {
        margin: -2px 0 8px;
        color: #64748B;
        font-size: 12px;
        line-height: 1.45;
      }
      .pdf-image-saver-prefs-check {
        display: inline-flex;
        align-items: center;
        gap: 6px;
      }
      @media (prefers-color-scheme: dark) {
        .pdf-image-saver-prefs-intro,
        .pdf-image-saver-prefs-row > p,
        .pdf-image-saver-prefs-note { color: #94A3B8; }
        .pdf-image-saver-prefs-save-notice { color: #4ADE80; }
        .pdf-image-saver-prefs-save-notice.is-error { color: #F87171; }
        .pdf-image-saver-prefs-section { border-bottom-color: #334155; }
        .pdf-image-saver-prefs-row { border-color: #334155; background: #111827; color: #F8FAFC; }
        .pdf-image-saver-prefs-advanced > summary { border-color: #64748B; background: #111827; color: #F8FAFC; }
        .pdf-image-saver-prefs-advanced > summary::after { color: #60A5FA; }
        .pdf-image-saver-prefs-summary-note { color: #94A3B8; }
      }
      @media (max-width: 640px) {
        .pdf-image-saver-prefs-row { grid-template-columns: 1fr; }
        .pdf-image-saver-prefs-row > p { grid-column: 1; }
      }
    `;
    doc.documentElement.appendChild(style);
  },

  bindControls(doc) {
    for (const id of [
      "pdf-image-saver-default-quality",
      "pdf-image-saver-default-category",
      "pdf-image-saver-duplicate-guard",
      "pdf-image-saver-min-area",
      "pdf-image-saver-max-page-images",
      "pdf-image-saver-max-document-images",
      "pdf-image-saver-helper-timeout",
      "pdf-image-saver-python-path",
    ]) {
      const control = doc.getElementById(id);
      if (!control || typeof control.addEventListener !== "function") {
        continue;
      }
      control.addEventListener("change", () => {
        this.saveControl(doc, id);
      });
    }
    const browseButton = doc.getElementById("pdf-image-saver-python-browse");
    if (browseButton && typeof browseButton.addEventListener === "function") {
      browseButton.addEventListener("click", (event) => {
        event?.preventDefault?.();
        void this.choosePythonExecutable(doc);
      });
    }
  },

  controlPreferences: {
    "pdf-image-saver-default-quality": { name: "defaultQuality", label: "默认预览质量", fallback: "medium", type: "text", choice: "quality" },
    "pdf-image-saver-default-category": { name: "defaultImageCategory", label: "确认窗口初始类别", fallback: "auto", type: "text", choice: "category" },
    "pdf-image-saver-duplicate-guard": { name: "duplicateGuard", label: "避免重复保存", fallback: true, type: "boolean" },
    "pdf-image-saver-min-area": { name: "minImageArea", label: "最小原图面积比例（占页面）", fallback: 0.004, type: "number", min: 0.001, max: 0.5, step: 0.001, decimals: 3 },
    "pdf-image-saver-max-page-images": { name: "maxPageImages", label: "每页最多原图数", fallback: 80, type: "number", min: 1, max: 500, step: 1, decimals: 0 },
    "pdf-image-saver-max-document-images": { name: "maxDocumentImages", label: "每篇最多原图数", fallback: 250, type: "number", min: 1, max: 2000, step: 1, decimals: 0 },
    "pdf-image-saver-helper-timeout": { name: "helperTimeoutSeconds", label: "高级原图提取超时", fallback: 60, type: "number", min: 5, max: 600, step: 1, decimals: 0 },
    "pdf-image-saver-python-path": { name: "pythonPath", label: "Python 路径", fallback: "", type: "text" },
  },

  // Returns the labels of preferences whose stored value had to be repaired, so the pane can say
  // what it changed instead of silently rewriting the user's settings.
  loadControls(doc) {
    const repaired = [];
    for (const [id, config] of Object.entries(this.controlPreferences)) {
      const control = doc.getElementById(id);
      if (!control) continue;
      const value = this.getPref(config.name, config.fallback);
      if (config.type === "boolean") {
        const normalizedValue = this.normalizeBooleanPreference(value, config.fallback);
        control.checked = normalizedValue;
        if (typeof value !== "boolean" || value !== normalizedValue) {
          this.writePreference(config, normalizedValue);
          repaired.push(config.label);
        }
      } else if (config.type === "number") {
        const rawText = String(value ?? "").trim();
        const rawNumber = rawText ? Number(rawText) : Number.NaN;
        const normalizedValue = this.normalizeNumericPreference(rawText, config);
        control.value = String(normalizedValue);
        if (!Number.isFinite(rawNumber) || Math.abs(rawNumber - normalizedValue) > 1e-9) {
          this.writePreference(config, normalizedValue);
          repaired.push(config.label);
        }
      } else {
        const rawText = String(value ?? "").trim();
        const normalizedValue = this.normalizeTextPreference(rawText, config);
        control.value = normalizedValue;
        if (rawText !== normalizedValue) {
          this.writePreference(config, normalizedValue);
          repaired.push(config.label);
        }
      }
    }
    return repaired;
  },

  formatRepairNotice(repaired) {
    const labels = Array.isArray(repaired) ? repaired.filter(Boolean) : [];
    if (!labels.length) {
      return "";
    }
    const shown = labels.slice(0, 3).join("、");
    const rest = labels.length > 3 ? `等 ${labels.length} 项` : "";
    return `已修复上次遗留的异常设置并保存：${shown}${rest}。当前显示的就是生效值。`;
  },

  saveControl(doc, id) {
    const config = this.controlPreferences[id];
    const control = doc.getElementById(id);
    if (!config || !control) return;
    const typedText = config.type === "boolean" ? "" : String(control.value ?? "").trim();
    let value = config.type === "boolean" ? Boolean(control.checked) : typedText;
    if (config.type === "number") {
      value = this.normalizeNumericPreference(value, config);
      control.value = String(value);
    } else if (config.type === "text") {
      value = this.normalizeTextPreference(value, config);
      control.value = value;
    }
    const adjusted = config.type !== "boolean" && typedText !== String(value);
    const saved = this.writePreference(config, value);
    if (!saved) {
      this.updateSaveNotice(doc, "设置保存失败，请重新打开设置页后再试。", true);
      return;
    }
    this.updateSaveNotice(doc, adjusted
      ? `已自动保存：${config.label}；输入的“${typedText || "空"}”超出允许范围，已改为 ${value}。`
      : `已自动保存：${config.label}。`);
  },

  writePreference(config, value) {
    try {
      Zotero?.Prefs?.set?.(`${this.PREF_PREFIX}${config.name}`, value, true);
      return true;
    } catch (_error) {
      // The preference pane remains usable in isolated preview contexts.
      return false;
    }
  },

  updateSaveNotice(doc, message = "设置修改后自动保存，无需另点确认。", isError = false) {
    const notice = doc?.getElementById?.("pdf-image-saver-prefs-save-notice");
    if (!notice) {
      return false;
    }
    notice.textContent = message;
    notice.classList?.toggle?.("is-error", Boolean(isError));
    return true;
  },

  normalizeNumericPreference(rawValue, config) {
    const fallback = Number(config?.fallback);
    const parsed = String(rawValue ?? "").trim() ? Number(rawValue) : fallback;
    const finiteValue = Number.isFinite(parsed) ? parsed : fallback;
    const min = Number.isFinite(Number(config?.min)) ? Number(config.min) : finiteValue;
    const max = Number.isFinite(Number(config?.max)) ? Number(config.max) : finiteValue;
    const bounded = Math.min(max, Math.max(min, finiteValue));
    const step = Number(config?.step);
    const stepped = Number.isFinite(step) && step > 0
      ? min + Math.round((bounded - min) / step) * step
      : bounded;
    const decimals = Math.max(0, Math.min(6, Math.round(Number(config?.decimals) || 0)));
    return Number(stepped.toFixed(decimals));
  },

  normalizeTextPreference(rawValue, config) {
    const value = String(rawValue ?? "").trim();
    const choices = config?.choice === "quality"
      ? this.QUALITY
      : config?.choice === "category"
        ? this.IMAGE_CATEGORIES
        : null;
    if (!choices) {
      return value;
    }
    return Object.prototype.hasOwnProperty.call(choices, value) ? value : String(config.fallback);
  },

  normalizeBooleanPreference(rawValue, fallback) {
    if (typeof rawValue === "boolean") {
      return rawValue;
    }
    const value = String(rawValue ?? "").trim().toLowerCase();
    if (["false", "0", "no", "off"].includes(value)) {
      return false;
    }
    if (["true", "1", "yes", "on"].includes(value)) {
      return true;
    }
    return Boolean(fallback);
  },

  async choosePythonExecutable(doc = document) {
    const control = doc?.getElementById?.("pdf-image-saver-python-path");
    const pickerInfo = this.createNativeFilePicker(doc);
    if (!control || !pickerInfo) {
      this.updateSaveNotice(doc, "无法打开系统文件选择器；请手动粘贴 Python 解释器路径。", true);
      return false;
    }
    const { picker, interfaces } = pickerInfo;
    try {
      picker.init(
        doc?.defaultView || (typeof window !== "undefined" ? window : null),
        "选择 Python 解释器",
        interfaces.nsIFilePicker.modeOpen,
      );
      picker.appendFilter?.("Python 解释器", "*.exe;*.bat;*.cmd;python;python3");
      if (Number.isFinite(interfaces.nsIFilePicker.filterAll)) {
        picker.appendFilters?.(interfaces.nsIFilePicker.filterAll);
      }
      const result = await this.openNativeFilePicker(picker);
      if (result !== interfaces.nsIFilePicker.returnOK) {
        return false;
      }
      const selectedFile = picker.file;
      const path = String(typeof selectedFile === "string" ? selectedFile : selectedFile?.path || "").trim();
      if (!path) {
        this.updateSaveNotice(doc, "未取得所选 Python 解释器路径；请重新选择或手动粘贴路径。", true);
        return false;
      }
      control.value = path;
      this.saveControl(doc, "pdf-image-saver-python-path");
      control.focus?.();
      return true;
    } catch (_error) {
      this.updateSaveNotice(doc, "系统文件选择器不可用；请手动粘贴 Python 解释器路径。", true);
      return false;
    }
  },

  createNativeFilePicker(doc) {
    const ownerWindow = doc?.defaultView || (typeof window !== "undefined" ? window : null);
    const chromeUtils = typeof ChromeUtils !== "undefined"
      ? ChromeUtils
      : ownerWindow?.ChromeUtils || null;
    try {
      const FilePicker = chromeUtils?.importESModule?.("chrome://zotero/content/modules/filePicker.mjs")?.FilePicker;
      if (typeof FilePicker === "function") {
        const picker = new FilePicker();
        return {
          picker,
          interfaces: {
            nsIFilePicker: {
              modeOpen: picker.modeOpen,
              returnOK: picker.returnOK,
              filterAll: picker.filterAll,
            },
          },
        };
      }
    } catch (_error) {
      // The direct XPCOM fallback below keeps the chooser available in older hosts.
    }
    const componentSource = typeof Components !== "undefined"
      ? Components
      : ownerWindow?.Components || null;
    const classes = componentSource?.classes;
    const interfaces = componentSource?.interfaces;
    const factory = classes?.["@mozilla.org/filepicker;1"];
    if (!factory || !interfaces?.nsIFilePicker) {
      return null;
    }
    return {
      picker: factory.createInstance(interfaces.nsIFilePicker),
      interfaces,
    };
  },

  openNativeFilePicker(picker) {
    return new Promise((resolve, reject) => {
      try {
        if (typeof picker?.show === "function") {
          Promise.resolve(picker.show()).then(resolve, reject);
          return;
        }
        if (typeof picker?.open === "function") {
          picker.open((result) => resolve(result));
          return;
        }
        reject(new Error("系统文件选择器不可用。"));
      } catch (error) {
        reject(error);
      }
    });
  },

  getPreviewQuality(doc) {
    const key = this.normalizeQualityKey(
      this.getControlText(doc, "pdf-image-saver-default-quality")
      || this.getTextPref("defaultQuality", "medium"),
    );
    return this.QUALITY[key];
  },

  getImageCategory(doc) {
    const key = this.normalizeImageCategoryKey(
      this.getControlText(doc, "pdf-image-saver-default-category")
      || this.getTextPref("defaultImageCategory", "auto"),
    );
    return this.IMAGE_CATEGORIES[key];
  },

  normalizeQualityKey(value) {
    const key = String(value || "").trim().toLowerCase();
    return Object.prototype.hasOwnProperty.call(this.QUALITY, key) ? key : "medium";
  },

  normalizeImageCategoryKey(value) {
    const key = String(value || "").trim().toLowerCase();
    return Object.prototype.hasOwnProperty.call(this.IMAGE_CATEGORIES, key) ? key : "auto";
  },

  getHelperMinArea(doc) {
    return this.getClampedNumber(doc, "pdf-image-saver-min-area", this.getPref("minImageArea", 0.004), 0.001, 0.5, 3);
  },

  getHelperPageMax(doc) {
    return this.getClampedNumber(doc, "pdf-image-saver-max-page-images", this.getPref("maxPageImages", 80), 1, 500);
  },

  getHelperDocMax(doc) {
    return this.getClampedNumber(doc, "pdf-image-saver-max-document-images", this.getPref("maxDocumentImages", 250), 1, 2000);
  },

  getHelperTimeout(doc) {
    return this.getClampedNumber(doc, "pdf-image-saver-helper-timeout", this.getPref("helperTimeoutSeconds", 60), 5, 600);
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
      const value = zotero?.Prefs?.get?.(`${this.PREF_PREFIX}${name}`, true);
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

if (typeof window !== "undefined" && typeof window.addEventListener === "function") {
  window.addEventListener("showing", (event) => {
    const root = event?.target;
    if (root?.id === "pdf-image-saver-preferences") {
      PdfImageSaverPreferences.init(root.ownerDocument || document);
    }
  }, true);
}
