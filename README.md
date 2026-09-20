# PDF 图片保存

PDF 图片保存是一个 Zotero 插件，用于在阅读论文时框选图表、确认类别和清晰度，并把原图保存到本机外部 SQLite 原图库。图库支持搜索、筛选、高清查看、批量分享和导入，也可以供 PPT 插件按同一套协议复用。

修改本项目前请先阅读 [PROJECT_CONSTRAINTS.md](PROJECT_CONSTRAINTS.md)。该文件是当前仓库的修改合同。

## 功能概览

- 在 Zotero PDF 阅读器中框选任意区域，保存前可修改图片类别和清晰度，并填写自定义描述。
- 自动读取附近图注或正文引用，为确认窗口推荐科研绘图类别；也支持表格。
- 当前论文索引和全局图库直接读取外部 SQLite 中的 `image_blob` 原图字节，不生成缩略图或第二份图像存储。
- 全局图库支持搜索（含自定义描述）、类别／色调／年份／来源筛选、排序、表格视图、高清查看器、批量选择、删除、分享和导入。
- 自定义描述最多 300 字、保留换行；采集时填写，保存后可在图库卡片上直接编辑并写回数据库，也会随分享包一起导出。
- 阅读器清晰度菜单支持方向键、Home、End 和 Esc；图库原图临时文件加载失败时显示中文恢复提示。
- 设置页修改即时保存；异常值修复和文件选择器不可用都会给出中文提示。
- 移动宽度下图库批量按钮自动换行，完整显示“导入分享包”等操作。
- `.pislib` 分享包包含原图和白名单元数据；不包含你的 PDF、Zotero 条目或本机定位 ID。导入后未匹配文献的图片仍可浏览。
- 主要界面使用中文，并沿用 SimpleExperiment 的扁平配色和按钮尺寸策略。

## 系统要求

- Windows 10 或 Windows 11，64 位。
- Zotero 10.x 或 11.x。清单兼容字段声明 `7.0` 下限与 `11.*` 上限，覆盖 Zotero 10 和 11 全系列；公开支持、自动化验证和发布说明以 Zotero 10 为准。
- 已在 Zotero 中安装并打开 PDF 阅读器插件自带的 PDF 阅读界面。
- 框选保存、SQLite 图库和 PPT 连接不需要 Python、Conda 或联网。
- “高级原图提取”是可选功能；只有使用它才需要 `python.exe` 和 PyMuPDF。

## 手动安装 XPI

1. 获取发布者提供的 `pdf-image-saver-<版本>.xpi`。不要把 `.sha256` 文件当作插件安装。
2. 如需校验文件，在 PowerShell 中执行：

   ```powershell
   Get-FileHash -Algorithm SHA256 .\pdf-image-saver-<版本>.xpi
   Get-Content -Encoding ASCII .\pdf-image-saver-<版本>.xpi.sha256
   ```

3. 打开 Zotero，进入“工具 > 插件”。
4. 在插件管理器右上角齿轮菜单中选择“从文件安装插件…”。
5. 选择刚下载的 `.xpi` 文件，确认安装提示。
6. 如果 Zotero 要求重启，请重启 Zotero。

清单里的 `update_url` 指向仓库中的 `updates.json`，该文件是空 feed（`{"addons": {}}`），Zotero 查不到条目就不会下载任何更新。升级仍然必须手动获取新版 XPI，再按上面的步骤安装覆盖。

首次启动时会自动创建：

- `%LOCALAPPDATA%\ZLK\paper-image-library\paper_images.sqlite`
- `%LOCALAPPDATA%\ZLK\paper-image-library\library.json`

不需要手动建表或导入数据库模板。

## 更新插件

本项目不提供可用的在线更新源。`update_url` 指向的空 feed 只用于满足 Zotero 10 的清单要求，不会推送新版；升级必须退出 Zotero，获取新版稳定 XPI 后用插件管理器从文件安装。安装器会处理替换流程，避免插件运行中改写自身文件带来的占用和半写入风险。

## 使用方法

### 框选保存

1. 打开一篇 PDF。
2. 无需选择清晰度：统一按最高保真度保存 —— 选区含矢量内容时保存为矢量，否则保存 600 DPI 无损 PNG。
3. 点击“框选保存”，或在 PDF 页面右键选择对应入口。
4. 拖出矩形范围。整页会变暗，绿色虚线显示实时范围，虚线内部保持正常亮度。
5. 在确认窗口中检查预览、类别、PPT 用途、实际保存画质和自定义描述。
6. 点击“确认并保存”后才写入数据库；“取消”不会入库。

小于 12 × 12 像素的选择不会提交。框选期间会临时抑制 PDF 选词行为；Esc 或右键可取消。

### 查看和管理图库

- 工具栏中的“本篇图片”只查看当前论文。
- 工具栏中的“全部图库”跨论文筛选和管理图片。
- “工具”菜单提供相同的图库入口和诊断。
- 图库卡片下方显示论文、类别、年份、页码、尺寸、大小、来源匹配状态、保存时间、配色、标签和自定义描述；表格视图有独立的“描述”列。
- 卡片上的“编辑描述”可就地修改描述并写回数据库；Zotero 未运行时该按钮禁用并给出中文说明。
- 高清查看器支持适应窗口、原始像素、有界放大缩小、前后切换和原图下载；有关联描述时在标题下单独显示。
- 高清查看器是页内浮层，不会打开新的浏览器标签页；关闭控件显示 `×`，关闭后焦点回到打开它的图片。
- 查看器支持鼠标滚轮以光标为中心缩放、按住拖动平移，并在左下角提供鸟瞰图。
- 查看器仅保留笔刷、橡皮和文字；B/E/T 切换工具，点击已有文字可继续编辑。滚轮缩放，按住 Ctrl 拖动平移，标注与原图同步变换。查看器标明原图为 SVG 矢量或位图，导出状态和错误会直接显示在工具栏。导出 SVG 时标注保留矢量路径和文字；若原图本身是位图，它在 SVG 中仍是位图，需从原 PDF 重新框选含矢量内容的区域才能得到矢量原图。
- 框选保存不再裁剪阅读器屏幕上的画面（那通常只有约 145 DPI），而是按所选 DPI 重新渲染选区，因此保存的图始终清晰。
- 框选区含 PDF 绘图或文字时优先保存为 SVG，即使 SVG 比位图预览更大；纯位图区域沿用位图保存路径。插件自带 Python 和 PyMuPDF，无需本机安装。
- 「下载原图」在图库中始终留在当前页面内完成，不会把图库页导航走。
- 批量操作支持全选、Shift 区间选择、清空、分享、软删除和导入分享包。

### 定位原文

本机保存的记录保留 PDF attachment key、页码、来源区域和 `zotero://open-pdf` 链接。图库中匹配到本地条目时可跳回原文页。分享给其他人的图片不携带这些本机标识，因此只能显示标题、页码等图片事实，不能保证对方也能跳转。

## 数据与隐私

唯一持久图片库是：

```text
%LOCALAPPDATA%\ZLK\paper-image-library\paper_images.sqlite
```

原图保存在 `images.image_blob` 中。插件不创建 HTML 预览附件、缩略图库、预览数据库或其他图像副本。数据库初始化、读取和写入都在本机完成；插件没有在线更新检查，不上传图片或文献数据。

插件不读取、复制或修改 Zotero 内部的 `zotero.sqlite`、`zotero.sqlite-wal` 或 `zotero.sqlite-shm`。

## PPT 插件接入

PPT 插件应直接复用本项目的图库界面和数据协议：

- 数据库与访问规则见 [docs/IMAGE_LIBRARY_ACCESS_AND_UI_PROTOCOL.md](docs/IMAGE_LIBRARY_ACCESS_AND_UI_PROTOCOL.md)。
- 分享包、导入和安全边界见 [docs/IMAGE_LIBRARY_SHARING_PROTOCOL.md](docs/IMAGE_LIBRARY_SHARING_PROTOCOL.md)。
- 本地桥接地址是 `POST http://127.0.0.1:23119/pdf-image-saver/bridge`。
- 外部消费端只能调用 `refreshLibrary` 和冻结的来源定位命令，不得发送 `deleteImages`、`exportImages` 或 `importImages`。

## 常见问题

### 安装时提示不兼容

确认下载的是 `.xpi`，而不是 `.sha256`。确认 ZIP 内部路径由打包脚本生成，不要手动用资源管理器重新压缩。公开版本要求 Zotero 10.x 或 11.x；旧版 Zotero 不在本项目验证范围内。

Zotero 10 还会拒绝缺少 `applications.zotero.update_url` 的扩展，本项目因此声明了该字段，但它指向的空 feed 不会推送任何更新。清单里的 `strict_max_version` 只覆盖到 `11.*`，Zotero 升到 12 时需要重新发布。

### 为什么没有检查更新入口

插件自身不实现更新检查，也不提供可用的更新源。清单里的 `update_url` 是 Zotero 10 的强制字段，指向仓库中的空 feed，只用于让插件能装上；请使用发布者分发的新版 XPI 手动升级。

### 高级原图提取不可用

插件已内置便携版 Python 与 PyMuPDF，无需本机安装任何东西即可使用矢量保存。下面的命令只在你需要单独配置系统 Python 时才用得到：

```powershell
python -m pip install --user PyMuPDF
```

### 图片没有出现在 PPT 插件里

先确认路径存在且 `paper_images.sqlite` 可读，再从 PPT 插件刷新图库。PPT 必须读取 `library.json` 指向的唯一数据库，不应维护第二套图库索引。

## 开发与验证

在仓库根目录执行：

```powershell
npm.cmd test
npm.cmd run check
npm.cmd run audit:index-buttons
npm.cmd run build
npm.cmd run package:manual
```

`npm.cmd run check` 包含单元和静态检查、PPT 协议闸门以及无头 Chromium UI 审计。缺少协作仓库或浏览器时，对应外部闸门会明确跳过而不是误报失败。

开发代理安装仅用于本机调试：

```powershell
npm.cmd run install:global
```

普通用户请使用发布者提供的 XPI 手动安装，不要使用开发代理。

## 发布新版本

1. 同步 `package.json`、`manifest.json` 和 `tests/current-release.test.js` 的版本断言。
2. 运行 `npm.cmd run check` 和 `npm.cmd run build`。
3. 本地生成稳定命名产物 `outputs/pdf-image-saver-<版本>.xpi` 与 `.sha256`。
4. 提交并通过普通快进推送到 `origin/master`。`updates.json` 必须在同一提交里保持在仓库根目录，否则清单里的 `update_url` 会解析失败。
5. 如需公开分发，把本地构建的稳定 XPI 和 SHA256 手动上传到发布页；本项目不使用 GitHub Actions 构建，也不向 `updates.json` 写入更新条目。
