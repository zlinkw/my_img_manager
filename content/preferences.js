var PdfImageSaverPreferences = {
  init() {
    const doc = document;
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
        color: #666;
      }
    `;
    doc.documentElement.appendChild(style);
    const status = doc.getElementById("pdf-image-saver-prefs-status");
    if (status) {
      status.textContent = "Preview indexes follow Zotero attachment sync. Optional original extraction may need Python and PyMuPDF.";
    }
  },
};
