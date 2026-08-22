# PDF 图片保存

PDF 图片保存是一个 Zotero 插件，用于在阅读论文时框选图表、确认类别和清晰度，并把原图保存到本机外部 SQLite 原图库。图库支持搜索、筛选、高清查看、批量分享和导入，也可以供 PPT 插件按同一套协议复用。

修改本项目前请先阅读 [PROJECT_CONSTRAINTS.md](PROJECT_CONSTRAINTS.md)。该文件是当前仓库的修改合同。

## 功能概览

- 在 Zotero PDF 阅读器中框选任意区域，保存前可修改图片类别和清晰度。
- 自动读取附近图注或正文引用，为确认窗口推荐科研绘图类别；也支持表格。
- 当前论文索引和全局图库直接读取外部 SQLite 中的 `image_blob` 原图字节，不生成缩略图或第二份图像存储。
- 全局图库支持搜索、类别／色调／年份／来源筛选、排序、表格视图、高清查看器、批量选择、删除、分享和导入。
- `.pislib` 分享包包含原图和白名单元数据；不包含你的 PDF、Zotero 条目或本机定位 ID。导入后未匹配文献的图片仍可浏览。
- 主要界面使用中文，并沿用 SimpleExperiment 的扁平配色和按钮尺寸策略。

## 系统要求

- Windows 10 或 Windows 11，64 位。
- Zotero 9.x。清单兼容字段保留 `7.0` 下限，但公开支持、自动化验证和发布说明以 Zotero 9 为准。
- 已在 Zotero 中安装并打开 PDF 阅读器插件自带的 PDF 阅读界面。
- 框选保存、SQLite 图库、PPT 连接和更新检查不需要 Python、Conda 或额外运行环境。
- “高级原图提取”是可选功能；只有使用它才需要 `python.exe` 和 PyMuPDF。

## 从 GitHub Release 安装

1. 打开项目的 GitHub Releases 页面：<https://github.com/zlinkw/my_img_manager/releases/latest>。
2. 从最新正式版下载 `pdf-image-saver-<版本>.xpi`。不要把 `.sha256` 文件当作插件安装。
3. 如需校验文件，在 PowerShell 中执行：

   ```powershell
   Get-FileHash -Algorithm SHA256 .\pdf-image-saver-<版本>.xpi
   Get-Content -Encoding ASCII .\pdf-image-saver-<版本>.xpi.sha256
   ```

4. 打开 Zotero，进入“工具 > 插件”。
5. 在插件管理器右上角齿轮菜单中选择“从文件安装插件…”。
6. 选择刚下载的 `.xpi` 文件，确认安装提示。
7. 如果 Zotero 要求重启，请重启 Zotero。

首次启动时会自动创建：

- `%LOCALAPPDATA%\ZLK\paper-image-library\paper_images.sqlite`
- `%LOCALAPPDATA%\ZLK\paper-image-library\library.json`

不需要手动建表或导入数据库模板。

## 更新插件

插件提供两种更新途径：

- Zotero 插件管理器可以读取 `updates.json` 并在有新的正式 Release 时提示更新。
- 在 Zotero 中进入“工具 > 检查 PDF 图片保存更新”，或在设置页“插件更新”区域点击“检查更新”。插件会实时读取 GitHub Latest Release，比较语义化版本号。

发现新版本后，点击“打开发布页”，下载稳定版 XPI，再通过 Zotero 插件管理器确认安装。Zotero 插件运行在特权沙箱中，不能安全地像 Linux 服务那样执行 Git 快进、覆盖自身文件并重启进程；插件因此不会静默替换 XPI。这样也能避免 Windows 文件占用、半写入包和权限问题。

## 使用方法

### 框选保存

1. 打开一篇 PDF。
2. 使用阅读器工具栏的清晰度菜单选择低、中或高。
3. 点击“框选保存”，或在 PDF 页面右键选择对应入口。
4. 拖出矩形范围。整页会变暗，绿色虚线显示实时范围，虚线内部保持正常亮度。
5. 在确认窗口中检查预览、类别、PPT 用途和实际保存画质。
6. 点击“确认并保存”后才写入数据库；“取消”不会入库。

小于 12 × 12 像素的选择不会提交。框选期间会临时抑制 PDF 选词行为；Esc 或右键可取消。

### 查看和管理图库

- 工具栏中的“本篇图片”只查看当前论文。
- 工具栏中的“全部图库”跨论文筛选和管理图片。
- “工具”菜单提供相同的图库入口、诊断和更新检查。
- 图库卡片下方显示论文、类别、年份、页码、尺寸、大小、来源匹配状态、保存时间、配色和标签。
- 高清查看器支持适应窗口、原始像素、有界放大缩小、前后切换和原图下载。
- 批量操作支持全选、Shift 区间选择、清空、分享、软删除和导入分享包。

### 定位原文

本机保存的记录保留 PDF attachment key、页码、来源区域和 `zotero://open-pdf` 链接。图库中匹配到本地条目时可跳回原文页。分享给其他人的图片不携带这些本机标识，因此只能显示标题、页码等图片事实，不能保证对方也能跳转。

## 数据与隐私

唯一持久图片库是：

```text
%LOCALAPPDATA%\ZLK\paper-image-library\paper_images.sqlite
```

原图保存在 `images.image_blob` 中。插件不创建 HTML 预览附件、缩略图库、预览数据库或其他图像副本。数据库初始化、读取和写入都在本机完成；更新检查只向 GitHub API 发送一次只读请求，不上传图片或文献数据。

插件不读取、复制或修改 Zotero 内部的 `zotero.sqlite`、`zotero.sqlite-wal` 或 `zotero.sqlite-shm`。

## PPT 插件接入

PPT 插件应直接复用本项目的图库界面和数据协议：

- 数据库与访问规则见 [docs/IMAGE_LIBRARY_ACCESS_AND_UI_PROTOCOL.md](docs/IMAGE_LIBRARY_ACCESS_AND_UI_PROTOCOL.md)。
- 分享包、导入和安全边界见 [docs/IMAGE_LIBRARY_SHARING_PROTOCOL.md](docs/IMAGE_LIBRARY_SHARING_PROTOCOL.md)。
- 本地桥接地址是 `POST http://127.0.0.1:23119/pdf-image-saver/bridge`。
- 外部消费端只能调用 `refreshLibrary` 和冻结的来源定位命令，不得发送 `deleteImages`、`exportImages` 或 `importImages`。

## 常见问题

### 安装时提示不兼容

确认下载的是 `.xpi`，而不是 `.sha256`。确认 ZIP 内部路径由打包脚本生成，不要手动用资源管理器重新压缩。公开版本要求 Zotero 9.x；旧版 Zotero 不在本项目验证范围内。

### 更新按钮说“暂无正式 GitHub Release”

项目还没有推送正式 tag，或最新 Release 被标记为 draft/prerelease。只有非草稿、非预发布的 Latest Release 会参与比较。

### 高级原图提取不可用

这不影响框选保存。只有需要从 PDF 中提取嵌入原图时，才设置 `python.exe` 并安装 PyMuPDF：

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

普通用户请使用 GitHub Release 的 XPI 手动安装，不要使用开发代理。

## 发布新版本

1. 同步 `package.json`、`manifest.json`、`preferences.xhtml` 中的当前版本展示、`tests/current-release.test.js` 的版本断言和根目录 `updates.json`。
2. 运行 `npm.cmd run check` 和 `npm.cmd run build`。
3. 提交并通过普通快进推送到 `origin/master`。
4. 创建符合 `v<主>.<次>.<补丁>` 格式的 tag 并推送，例如 `v0.2.0`。
5. GitHub Actions 会在 Windows runner 上校验源码，构建稳定命名 XPI 和 SHA256 文件，并用生成说明创建 Release。

`updates.json` 中的链接指向固定名称资产 `pdf-image-saver-<版本>.xpi`。每次发版必须递增版本号并同步该文件。
