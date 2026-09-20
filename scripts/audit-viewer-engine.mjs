// Dedicated audit for the OpenSeadragon + Fabric viewer engine.
//
// The main UI audit deliberately runs without the vendored libraries so it keeps covering the
// plain-image fallback. This one stages them the way the plugin does, so the engine path is
// exercised in a real browser too: cursor-centred wheel zoom, the bottom-left overview map, and
// the annotation tools.
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const root = path.dirname(scriptDirectory);
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "pdf-image-saver-viewer-audit-"));
const fixture = path.join(tempRoot, "library.html");

const runProcess = (command, args, options = {}) => new Promise((resolve, reject) => {
  const child = spawn(command, args, { stdio: "inherit", ...options });
  child.on("error", reject);
  child.on("close", (code) => (code === 0 ? resolve(code) : reject(new Error(`exit ${code}`))));
});

await runProcess(process.execPath, [path.join(root, "tests", "current-release.test.js")], {
  cwd: root,
  env: { ...process.env, PDF_IMAGE_SAVER_BROWSER_LIBRARY_FIXTURE: fixture },
});
assert.ok(fs.existsSync(fixture), "gallery fixture must be generated");
const fixtureHTML = fs.readFileSync(fixture, "utf8");
const sourceMatch = fixtureHTML.match(/data:image\/svg\+xml;base64,([A-Za-z0-9+/=]+)/);
assert.ok(sourceMatch, "fixture needs an SVG source for the real file path audit");
const sourceBase64 = sourceMatch[1];
const imageDirectory = path.join(tempRoot, "images");
fs.mkdirSync(imageDirectory, { recursive: true });
fs.writeFileSync(path.join(imageDirectory, "viewer-source.svg"), Buffer.from(sourceBase64, "base64"));
fs.writeFileSync(fixture, fixtureHTML.replaceAll(sourceMatch[0], "images/viewer-source.svg"), "utf8");

const vendorDirectory = path.join(tempRoot, "vendor");
fs.mkdirSync(vendorDirectory, { recursive: true });
for (const name of ["openseadragon.min.js", "fabric.min.js"]) {
  fs.copyFileSync(path.join(root, "content", "vendor", name), path.join(vendorDirectory, name));
}

const browserCandidates = [
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
];
const browserPath = browserCandidates.find((candidate) => fs.existsSync(candidate));
assert.ok(browserPath, "a Chromium browser is required for the viewer audit");

const userDataDirectory = path.join(tempRoot, "browser-profile");
const browser = spawn(browserPath, [
  "--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check",
  "--remote-debugging-port=0", "--user-data-dir=" + userDataDirectory, "about:blank",
], { stdio: "ignore", windowsHide: true });

const waitFor = async (produce, timeout = 30000) => {
  const started = Date.now();
  for (;;) {
    const value = await produce();
    if (value) return value;
    if (Date.now() - started > timeout) throw new Error("viewer audit timed out");
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
};

let client = null;
try {
  const activePortFile = path.join(userDataDirectory, "DevToolsActivePort");
  const activePort = await waitFor(() => {
    if (!fs.existsSync(activePortFile)) return null;
    const value = fs.readFileSync(activePortFile, "utf8").split(/\r?\n/)[0];
    return /^\d+$/.test(value) ? value : null;
  });
  const targets = await waitFor(async () => {
    const response = await fetch("http://127.0.0.1:" + activePort + "/json/list");
    const values = await response.json();
    return values.find((target) => target.type === "page" && target.webSocketDebuggerUrl) ? values : null;
  });
  const target = targets.find((entry) => entry.type === "page" && entry.webSocketDebuggerUrl);
  client = new WebSocket(target.webSocketDebuggerUrl);
  const pending = new Map();
  const downloadEvents = [];
  let nextID = 1;
  await new Promise((resolve, reject) => {
    client.addEventListener("open", resolve, { once: true });
    client.addEventListener("error", reject, { once: true });
  });
  client.addEventListener("message", (event) => {
    const message = JSON.parse(String(event.data));
    if (message.method === "Browser.downloadWillBegin") downloadEvents.push(message.params);
    if (!message.id) return;
    const request = pending.get(message.id);
    if (!request) return;
    pending.delete(message.id);
    if (message.error) request.reject(new Error(message.method + ": " + message.error.message));
    else request.resolve(message.result || {});
  });
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = nextID++;
    pending.set(id, { method, resolve, reject });
    client.send(JSON.stringify({ id, method, params }));
  });
  const evaluate = async (expression, timeout = 60000) => {
    const response = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true, timeout });
    if (response.exceptionDetails) {
      throw new Error(response.exceptionDetails.exception?.description || response.exceptionDetails.text);
    }
    return response.result?.value;
  };

  await send("Runtime.enable");
  await send("Page.enable");
  await send("Page.navigate", { url: pathToFileURL(fixture).href });
  await waitFor(async () => ((await evaluate("document.readyState")) === "complete" ? true : null));
  await new Promise((resolve) => setTimeout(resolve, 500));

  const libraries = await evaluate(`({ osd: typeof window.OpenSeadragon, fabric: typeof window.fabric })`);
  assert.equal(libraries.osd, "function", "OpenSeadragon must load as a classic script from a file:// page");
  assert.equal(libraries.fabric, "object", "Fabric must load as a classic script from a file:// page");

  const opened = await evaluate(`(async () => {
    document.querySelector(".library-card:not([hidden]) [data-open-image]").click();
    await new Promise(function (resolve) { setTimeout(resolve, 2500); });
    const osd = document.getElementById("viewer-osd");
    const navigator = document.querySelector("#viewer-navigator .navigator") || document.getElementById("viewer-navigator");
    const rect = navigator ? navigator.getBoundingClientRect() : null;
    return {
      protocol: location.protocol,
      imageID: document.querySelector(".library-card:not([hidden])").dataset.id,
      formatLabel: document.getElementById("viewer-meta").textContent,
      osdVisible: !osd.hidden,
      annotVisible: !document.getElementById("viewer-annot").hidden,
      vectorVisible: !document.getElementById("viewer-vector").hidden,
      editorVisible: !document.getElementById("viewer-editor").hidden,
      plainImageHidden: document.getElementById("viewer-image").hidden,
      navigatorPresent: !!navigator && navigator.childElementCount > 0 && !document.getElementById("viewer-navigator").hidden,
      navigatorLeft: rect ? Math.round(rect.left) : -1,
      navigatorFromBottom: rect ? Math.round(window.innerHeight - rect.bottom) : -1,
      toolCount: document.querySelectorAll("[data-editor-tool]").length,
      vectorWidth: document.getElementById("viewer-vector").getBoundingClientRect().width,
      initialZoom: document.getElementById("viewer-zoom-value").textContent,
    };
  })()`);
  assert.equal(opened.protocol, "file:", "this audit only means anything on a file:// gallery");
  assert.equal(opened.osdVisible, true, "opening a record must show the OpenSeadragon stage");
  assert.equal(opened.annotVisible, true, "opening a record must show the annotation layer");
  assert.equal(opened.vectorVisible, true, "SVG sources must display through the browser's vector image element");
  assert.ok(opened.formatLabel.includes("SVG 文件（导出前验证）"), "the viewer must avoid claiming that every SVG source is pure vector");
  assert.equal(opened.editorVisible, true, "opening a record must show the annotation toolbar");
  assert.equal(opened.plainImageHidden, true, "the engine replaces the plain image instead of stacking on it");
  assert.equal(opened.navigatorPresent, true, "the viewer must show a bird's-eye overview map");
  assert.ok(opened.navigatorLeft <= 40, "the overview map must sit on the left edge");
  assert.ok(opened.navigatorFromBottom <= 200, "the overview map must sit near the bottom edge");
  assert.equal(opened.toolCount, 3, "the annotation toolbar must expose brush, eraser and text");
  assert.equal(opened.initialZoom, "适应窗口", "the viewer must open with the whole image visible");

  // Wheel events must land on OpenSeadragon's own canvas: dispatching on the wrapper would never
  // reach it, because events do not propagate downwards.
  const wheel = await evaluate(`(async () => {
    const osd = document.getElementById("viewer-osd");
    const canvas = osd.querySelector("canvas") || osd;
    const rect = osd.getBoundingClientRect();
    const before = document.getElementById("viewer-zoom-value").textContent;
    for (let i = 0; i < 3; i += 1) {
      canvas.dispatchEvent(new WheelEvent("wheel", { bubbles: true, cancelable: true, deltaY: -120, clientX: Math.round(rect.left + rect.width / 2), clientY: Math.round(rect.top + rect.height / 2) }));
      await new Promise(function (resolve) { setTimeout(resolve, 260); });
    }
    return { before: before, after: document.getElementById("viewer-zoom-value").textContent,
      vectorWidth: document.getElementById("viewer-vector").getBoundingClientRect().width };
  })()`);
  assert.notEqual(wheel.after, wheel.before, "the mouse wheel must zoom the image");
  assert.ok(/%$/.test(wheel.after), "the zoom readout must report a real percentage");
  assert.ok(wheel.vectorWidth > opened.vectorWidth, "native SVG must scale with the image viewport");

  const buttons = await evaluate(`(async () => {
    document.getElementById("viewer-zoom-actual").click();
    await new Promise(function (resolve) { setTimeout(resolve, 1000); });
    const actual = document.getElementById("viewer-zoom-value").textContent;
    document.getElementById("viewer-zoom-fit").click();
    await new Promise(function (resolve) { setTimeout(resolve, 1200); });
    return { actual: actual, fitted: document.getElementById("viewer-zoom-value").textContent };
  })()`);
  assert.equal(buttons.actual, "100%", "1:1 must show the image at its original pixel size");
  assert.equal(buttons.fitted, "适应窗口", "fit must restore the complete-image view");

  const brush = await evaluate(`(async () => {
    const button = document.querySelector('[data-editor-tool="brush"]');
    button.click();
    await new Promise(function (resolve) { setTimeout(resolve, 250); });
    return { active: button.classList.contains("is-active"), pressed: button.getAttribute("aria-pressed") };
  })()`);
  assert.equal(brush.active, true, "the brush tool must arm itself visibly");
  assert.equal(brush.pressed, "true", "the brush tool must expose its state to assistive tech");

  const wheelArmed = await evaluate(`(async () => {
    const osd = document.getElementById("viewer-osd");
    const overlay = document.querySelector(".upper-canvas") || osd.querySelector("canvas") || osd;
    const rect = osd.getBoundingClientRect();
    const before = document.getElementById("viewer-zoom-value").textContent;
    for (let i = 0; i < 3; i += 1) {
      overlay.dispatchEvent(new WheelEvent("wheel", { bubbles: true, cancelable: true, deltaY: -120, clientX: Math.round(rect.left + rect.width / 2), clientY: Math.round(rect.top + rect.height / 2) }));
      await new Promise(function (resolve) { setTimeout(resolve, 260); });
    }
    return { before: before, after: document.getElementById("viewer-zoom-value").textContent };
  })()`);
  assert.notEqual(wheelArmed.after, wheelArmed.before, "the mouse wheel must still zoom while a drawing tool is armed");

  const beforePan = await evaluate(`(() => {
    const rect = document.getElementById("viewer-vector").getBoundingClientRect();
    return { left: rect.left, top: rect.top, x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  })()`);
  await send("Input.dispatchKeyEvent", { type: "keyDown", key: "Control", code: "ControlLeft", windowsVirtualKeyCode: 17, modifiers: 2 });
  await send("Input.dispatchMouseEvent", { type: "mousePressed", x: beforePan.x, y: beforePan.y, button: "left", clickCount: 1, modifiers: 2 });
  await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: beforePan.x + 65, y: beforePan.y + 35, button: "left", buttons: 1, modifiers: 2 });
  await send("Input.dispatchMouseEvent", { type: "mouseReleased", x: beforePan.x + 65, y: beforePan.y + 35, button: "left", clickCount: 1, modifiers: 2 });
  await send("Input.dispatchKeyEvent", { type: "keyUp", key: "Control", code: "ControlLeft", windowsVirtualKeyCode: 17 });
  await new Promise((resolve) => setTimeout(resolve, 700));
  const afterPan = await evaluate(`(() => {
    const rect = document.getElementById("viewer-vector").getBoundingClientRect();
    return { left: rect.left, top: rect.top };
  })()`);
  assert.ok(Math.abs(afterPan.left - beforePan.left) > 5 || Math.abs(afterPan.top - beforePan.top) > 5,
    "Ctrl+drag must pan the SVG image while a drawing tool is armed");

  const strokePoint = await evaluate(`(() => {
    const rect = document.getElementById("viewer-vector").getBoundingClientRect();
    return { x: Math.round(rect.left + rect.width * 0.4), y: Math.round(rect.top + rect.height * 0.4) };
  })()`);
  await send("Input.dispatchMouseEvent", { type: "mousePressed", x: strokePoint.x, y: strokePoint.y, button: "left", clickCount: 1 });
  await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: strokePoint.x + 35, y: strokePoint.y + 20, button: "left", buttons: 1 });
  await send("Input.dispatchMouseEvent", { type: "mouseReleased", x: strokePoint.x + 35, y: strokePoint.y + 20, button: "left", clickCount: 1 });
  const textPoint = await evaluate(`(() => {
    document.querySelector('[data-editor-tool="text"]').click();
    const rect = document.getElementById("viewer-vector").getBoundingClientRect();
    return { x: Math.round(rect.left + rect.width * 0.6), y: Math.round(rect.top + rect.height * 0.6) };
  })()`);
  for (let count = 0; count < 2; count += 1) {
    await send("Input.dispatchMouseEvent", { type: "mousePressed", x: textPoint.x, y: textPoint.y, button: "left", clickCount: 1 });
    await send("Input.dispatchMouseEvent", { type: "mouseReleased", x: textPoint.x, y: textPoint.y, button: "left", clickCount: 1 });
  }
  await send("Input.dispatchKeyEvent", { type: "keyDown", key: "a", code: "KeyA", modifiers: 2 });
  await send("Input.dispatchKeyEvent", { type: "keyUp", key: "a", code: "KeyA", modifiers: 2 });
  await send("Input.insertText", { text: "可编辑文字" });
  const exported = await evaluate(`(async () => {
    const originalCreate = URL.createObjectURL;
    const originalClick = HTMLAnchorElement.prototype.click;
    const originalFetch = window.fetch;
    let blob = null;
    let fileName = "";
    let bridgeRead = false;
    let bridgeImageID = "";
    URL.createObjectURL = function (value) { blob = value; return "blob:viewer-audit"; };
    HTMLAnchorElement.prototype.click = function () { fileName = this.download; };
    window.fetch = async function (_url, options) {
      bridgeRead = options.body.get("command") === "readImageBytes";
      bridgeImageID = options.body.get("image_id");
      return { ok: true, json: async () => ({ ok: true, mimeType: "image/svg+xml", base64: ${JSON.stringify(sourceBase64)} }) };
    };
    try {
      document.getElementById("viewer-editor-save").click();
      for (let attempt = 0; attempt < 20 && !blob; attempt += 1) await new Promise((resolve) => setTimeout(resolve, 20));
      const svg = blob ? await blob.text() : "";
      const xml = new DOMParser().parseFromString(svg, "image/svg+xml");
      const previewURL = originalCreate(blob);
      const preview = new Image();
      const loaded = await new Promise((resolve) => {
        preview.onload = () => resolve(preview.naturalWidth > 0 && preview.naturalHeight > 0);
        preview.onerror = () => resolve(false);
        preview.src = previewURL;
      });
      const sample = document.createElement("canvas");
      sample.width = sample.height = 16;
      const context = sample.getContext("2d");
      if (loaded) context.drawImage(preview, 0, 0, 16, 16);
      const sourceAlpha = loaded ? context.getImageData(1, 1, 1, 1).data[3] : 0;
      URL.revokeObjectURL(previewURL);
      const annotationTexts = [...xml.querySelectorAll("text")].filter((node) => {
        let ancestor = node.parentElement;
        while (ancestor && ancestor !== xml.documentElement) {
          if (ancestor.localName === "svg") return false;
          ancestor = ancestor.parentElement;
        }
        return true;
      });
      return { fileName, pathCount: xml.querySelectorAll("path").length, textCount: annotationTexts.length,
        inlinedVector: xml.querySelectorAll("svg").length >= 2 && xml.querySelectorAll("rect").length > 0,
        embeddedBitmap: !!xml.querySelector("image") || svg.includes("data:image/png"),
        parseError: !!xml.querySelector("parsererror"), loaded, sourceAlpha, bridgeRead, bridgeImageID,
        textValue: annotationTexts[0]?.textContent || "" };
    } finally {
      URL.createObjectURL = originalCreate;
      HTMLAnchorElement.prototype.click = originalClick;
      window.fetch = originalFetch;
    }
  })()`);
  assert.ok(exported.fileName.endsWith("-annotated.svg"), "annotated export must download SVG");
  assert.ok(exported.pathCount > 0, "a brush stroke must stay a vector path in the SVG export");
  assert.equal(exported.textCount, 1, "clicking existing text must edit it instead of creating a duplicate");
  assert.ok(exported.textValue.includes("可编辑文字"), "existing text must accept keyboard edits");
  assert.equal(exported.inlinedVector, true, "SVG export must inline the source geometry");
  assert.equal(exported.embeddedBitmap, false, "SVG export must contain no bitmap image element");
  assert.equal(exported.bridgeRead, true, "file-backed SVG export must read bytes supplied by the Zotero bridge");
  assert.equal(exported.bridgeImageID, opened.imageID, "SVG export must pass the selected image ID to the Zotero bridge");
  const exportStatus = await evaluate(`document.getElementById("viewer-editor-status").textContent`);
  assert.equal(exportStatus, "已开始下载 SVG", "the viewer must report export completion where the user can see it");

  const rasterStatus = await evaluate(`(async () => {
    window.fetch = async () => ({ ok: true, json: async () => ({ ok: true, mimeType: "image/png", base64: "iVBORw0KGgo=" }) });
    document.getElementById("viewer-editor-save").click();
    for (let attempt = 0; attempt < 20; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 20));
      if (document.getElementById("viewer-editor-status").dataset.error === "true") break;
    }
    return { text: document.getElementById("viewer-editor-status").textContent,
      error: document.getElementById("viewer-editor-status").dataset.error };
  })()`);
  assert.equal(rasterStatus.error, "true", "bitmap source must be blocked from SVG export");
  assert.ok(rasterStatus.text.includes("无法导出"), "bitmap export refusal must explain the reason in Chinese");

  const failureStatus = await evaluate(`(async () => {
    window.fetch = async () => ({ ok: false, status: 404, json: async () => ({ ok: false, error: "Image not found" }) });
    document.getElementById("viewer-editor-save").click();
    for (let attempt = 0; attempt < 20; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 20));
      if (document.getElementById("viewer-editor-status").dataset.error === "true") break;
    }
    return { text: document.getElementById("viewer-editor-status").textContent,
      error: document.getElementById("viewer-editor-status").dataset.error };
  })()`);
  assert.equal(failureStatus.error, "true", "the viewer must display an export error");
  assert.ok(failureStatus.text.includes("所选图片已不存在"), "the viewer must explain a missing image in Chinese");
  assert.equal(exported.parseError, false, "SVG export must be well formed");
  assert.equal(exported.loaded, true, "exported SVG must render as an image");
  assert.ok(exported.sourceAlpha > 0, "exported SVG must visibly include the original image");

  await send("Browser.setDownloadBehavior", { behavior: "allow", downloadPath: tempRoot, eventsEnabled: true });
  await evaluate(`(() => {
    window.fetch = async () => ({ ok: true, json: async () => ({ ok: true, mimeType: "image/svg+xml", base64: ${JSON.stringify(sourceBase64)} }) });
  })()`);
  const savePoint = await evaluate(`(() => {
    const rect = document.getElementById("viewer-editor-save").getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  })()`);
  await send("Input.dispatchMouseEvent", { type: "mousePressed", x: savePoint.x, y: savePoint.y, button: "left", clickCount: 1 });
  await send("Input.dispatchMouseEvent", { type: "mouseReleased", x: savePoint.x, y: savePoint.y, button: "left", clickCount: 1 });
  await waitFor(() => downloadEvents.length ? downloadEvents[0] : null, 3000);

  const closed = await evaluate(`(async () => {
    document.getElementById("viewer-close").click();
    await new Promise(function (resolve) { setTimeout(resolve, 400); });
    return { viewerHidden: document.getElementById("library-viewer").hidden, osdHidden: document.getElementById("viewer-osd").hidden };
  })()`);
  assert.equal(closed.viewerHidden, true, "closing the viewer must still return to the gallery");
  assert.equal(closed.osdHidden, true, "closing the viewer must tear the engine down");

  console.log("viewer engine audit ok: wheel zoom, bottom-left overview, 3 annotation tools, teardown on close");
} finally {
  try { client?.close(); } catch (_error) { /* ignore */ }
  browser.kill();
}
