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
  let nextID = 1;
  await new Promise((resolve, reject) => {
    client.addEventListener("open", resolve, { once: true });
    client.addEventListener("error", reject, { once: true });
  });
  client.addEventListener("message", (event) => {
    const message = JSON.parse(String(event.data));
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
    const navigator = osd.querySelector(".navigator");
    const rect = navigator ? navigator.getBoundingClientRect() : null;
    return {
      protocol: location.protocol,
      osdVisible: !osd.hidden,
      annotVisible: !document.getElementById("viewer-annot").hidden,
      editorVisible: !document.getElementById("viewer-editor").hidden,
      plainImageHidden: document.getElementById("viewer-image").hidden,
      navigatorPresent: !!navigator,
      navigatorLeft: rect ? Math.round(rect.left) : -1,
      navigatorFromBottom: rect ? Math.round(window.innerHeight - rect.bottom) : -1,
      toolCount: document.querySelectorAll("[data-editor-tool]").length,
      initialZoom: document.getElementById("viewer-zoom-value").textContent,
    };
  })()`);
  assert.equal(opened.protocol, "file:", "this audit only means anything on a file:// gallery");
  assert.equal(opened.osdVisible, true, "opening a record must show the OpenSeadragon stage");
  assert.equal(opened.annotVisible, true, "opening a record must show the annotation layer");
  assert.equal(opened.editorVisible, true, "opening a record must show the annotation toolbar");
  assert.equal(opened.plainImageHidden, true, "the engine replaces the plain image instead of stacking on it");
  assert.equal(opened.navigatorPresent, true, "the viewer must show a bird's-eye overview map");
  assert.ok(opened.navigatorLeft <= 40, "the overview map must sit on the left edge");
  assert.ok(opened.navigatorFromBottom <= 200, "the overview map must sit near the bottom edge");
  assert.equal(opened.toolCount, 6, "the annotation toolbar must expose the six documented tools");
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
    return { before: before, after: document.getElementById("viewer-zoom-value").textContent };
  })()`);
  assert.notEqual(wheel.after, wheel.before, "the mouse wheel must zoom the image");
  assert.ok(/%$/.test(wheel.after), "the zoom readout must report a real percentage");

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

  const closed = await evaluate(`(async () => {
    document.getElementById("viewer-close").click();
    await new Promise(function (resolve) { setTimeout(resolve, 400); });
    return { viewerHidden: document.getElementById("library-viewer").hidden, osdHidden: document.getElementById("viewer-osd").hidden };
  })()`);
  assert.equal(closed.viewerHidden, true, "closing the viewer must still return to the gallery");
  assert.equal(closed.osdHidden, true, "closing the viewer must tear the engine down");

  console.log("viewer engine audit ok: wheel zoom, bottom-left overview, 6 annotation tools, teardown on close");
} finally {
  try { client?.close(); } catch (_error) { /* ignore */ }
  browser.kill();
}
