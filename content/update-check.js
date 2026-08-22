var PdfImageSaverUpdateCheck = (() => {
  const REPOSITORY = "zlinkw/my_img_manager";
  const RELEASE_API_URL = `https://api.github.com/repos/${REPOSITORY}/releases/latest`;
  const RELEASE_PAGE_URL = `https://github.com/${REPOSITORY}/releases/latest`;
  const REQUEST_TIMEOUT_MS = 10000;

  let initialized = false;
  let currentVersion = "";
  let busy = false;
  let lastState = null;

  function init(data = {}) {
    currentVersion = normalizeVersion(String(data.version || ""));
    initialized = Boolean(currentVersion);
    if (lastState) {
      lastState.currentVersion = currentVersion;
    }
    return initialized;
  }

  function getCurrentVersion() {
    return currentVersion;
  }

  function isBusy() {
    return busy;
  }

  function getLastState() {
    return lastState;
  }

  function normalizeVersion(value) {
    const match = String(value ?? "").trim().match(/^v?(\d+(?:\.\d+){0,3})$/i);
    return match ? match[1] : "";
  }

  function compareSemanticVersions(left, right) {
    const parse = (value) => {
      const result = [0, 0, 0];
      String(normalizeVersion(value) || "0")
        .split(".")
        .slice(0, 3)
        .forEach((part, index) => {
          result[index] = Number.parseInt(part, 10) || 0;
        });
      return result;
    };
    const leftParts = parse(left);
    const rightParts = parse(right);
    for (let index = 0; index < leftParts.length; index += 1) {
      if (leftParts[index] < rightParts[index]) return -1;
      if (leftParts[index] > rightParts[index]) return 1;
    }
    return 0;
  }

  function formatUpdateError(error) {
    const raw = String(error?.message || error || "").trim();
    if (/NetworkError|Network error|NS_ERROR_NET|timed out|timeout/i.test(raw)) {
      return "网络连接失败或超时，请确认能否访问 GitHub 后重试。";
    }
    if (/HTTP 403/.test(raw)) {
      return "GitHub 拒绝了本次检查；请稍后重试。";
    }
    if (/HTTP 404/.test(raw)) {
      return "暂时没有可用的 GitHub 正式发布。";
    }
    if (/HTTP \d+/.test(raw)) {
      return `GitHub 发布检查失败（${raw.match(/HTTP \d+/)[0]}）。`;
    }
    if (/JSON|parse/i.test(raw)) {
      return "GitHub 返回的数据格式无效。";
    }
    if (/[\u3400-\u9fff]/.test(raw)) {
      return raw;
    }
    return "更新检查失败，请稍后重试。";
  }

  function validateRelease(release) {
    const version = normalizeVersion(release?.tag_name);
    if (!version) {
      throw new Error("GitHub Release 缺少有效的版本标签。");
    }
    if (release?.draft === true || release?.prerelease === true) {
      throw new Error("最新的 GitHub Release 不是正式版。");
    }
    if (!/^https:\/\/github\.com\//i.test(String(release?.html_url || ""))) {
      throw new Error("GitHub Release 缺少安全的发布页链接。");
    }
    return version;
  }

  function normalizeRelease(release, localVersion) {
    const latestVersion = validateRelease(release);
    const comparison = compareSemanticVersions(localVersion, latestVersion);
    return {
      status: comparison < 0 ? "update_available" : "up_to_date",
      message: comparison < 0 ? "发现新的正式版本。" : "已是最新正式版本。",
      currentVersion,
      latestVersion,
      releaseTag: String(release.tag_name || `v${latestVersion}`),
      releaseName: String(release.name || "").trim() || `v${latestVersion}`,
      releaseNotes: firstLine(release.body),
      releaseURL: String(release.html_url),
      checkedAt: new Date().toISOString(),
    };
  }

  async function fetchLatestRelease(runtime = typeof Zotero !== "undefined" ? Zotero : null) {
    if (typeof runtime?.HTTP?.request !== "function") {
      throw new Error("当前 Zotero 无法访问网络请求接口。");
    }
    let response;
    try {
      response = await runtime.HTTP.request("GET", RELEASE_API_URL, {
        responseType: "json",
        timeout: REQUEST_TIMEOUT_MS,
        headers: {
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
          "User-Agent": "pdf-image-saver-update-checker",
        },
      });
    } catch (error) {
      const status = Number(error?.status || error?.response?.status);
      if (status === 404) {
        return null;
      }
      throw new Error(`GitHub returned HTTP ${status || "error"}`);
    }
    const status = Number(response?.status || 0);
    if (status === 404) {
      return null;
    }
    if (status < 200 || status >= 300) {
      throw new Error(`GitHub returned HTTP ${status}`);
    }
    let payload = response?.response ?? response?.responseJSON;
    if (!payload || typeof payload !== "object") {
      try {
        payload = JSON.parse(response.responseText);
      } catch (_error) {
        throw new Error("invalid update JSON");
      }
    }
    return payload;
  }

  async function check(options = {}) {
    if (!initialized && !init(options)) {
      return fail("无法读取插件当前版本，请重启 Zotero 后重试。");
    }
    if (busy) {
      return lastState || { status: "checking", message: "正在检查更新。", currentVersion };
    }
    busy = true;
    options.onState?.({ status: "checking", message: "正在检查 GitHub 最新正式发布。", currentVersion });
    try {
      const release = await fetchLatestRelease(options.runtime);
      lastState = release
        ? normalizeRelease(release, currentVersion)
        : {
          status: "no_release",
          message: "暂无正式 GitHub Release。",
          currentVersion,
          releaseURL: RELEASE_PAGE_URL,
          checkedAt: new Date().toISOString(),
        };
      options.onState?.(lastState);
      return lastState;
    } catch (error) {
      lastState = fail(formatUpdateError(error));
      options.onState?.(lastState);
      return lastState;
    } finally {
      busy = false;
    }
  }

  function fail(message) {
    return {
      status: "error",
      message,
      currentVersion,
      releaseURL: RELEASE_PAGE_URL,
      checkedAt: new Date().toISOString(),
    };
  }

  function formatStatus(state) {
    const data = state || lastState;
    if (!data) {
      return "尚未检查更新。";
    }
    const checkedAt = data.checkedAt ? new Date(data.checkedAt).toLocaleString() : "";
    const suffix = checkedAt ? `（${checkedAt}）` : "";
    if (data.status === "update_available") {
      return `${data.message}最新 v${data.latestVersion}，当前 v${data.currentVersion}。请在 Zotero 插件管理器中安装下载到的 XPI。${suffix}`;
    }
    if (data.status === "up_to_date") {
      return `${data.message}当前 v${data.currentVersion}。${suffix}`;
    }
    return `${data.message}${suffix}`;
  }

  function openReleasePage(state, runtime = typeof Zotero !== "undefined" ? Zotero : null) {
    const url = String(state?.releaseURL || lastState?.releaseURL || RELEASE_PAGE_URL);
    if (!/^https:\/\/github\.com\//i.test(url)) {
      throw new Error("发布页链接不安全，已停止打开。");
    }
    if (typeof runtime?.launchURL !== "function") {
      throw new Error("当前环境无法打开外部链接。");
    }
    runtime.launchURL(url);
    return url;
  }

  function firstLine(value) {
    const line = String(value || "").trim().split(/\r?\n/, 1)[0].trim();
    return line.length > 180 ? `${line.slice(0, 177)}...` : line;
  }

  return {
    init,
    check,
    compareSemanticVersions,
    formatStatus,
    getCurrentVersion,
    getLastState,
    isBusy,
    normalizeRelease,
    normalizeVersion,
    openReleasePage,
    validateRelease,
    __test__: {
      REPOSITORY,
      RELEASE_API_URL,
      RELEASE_PAGE_URL,
      formatUpdateError,
    },
  };
})();
