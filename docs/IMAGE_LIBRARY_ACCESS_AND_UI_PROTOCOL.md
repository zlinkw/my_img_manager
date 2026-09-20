# 论文图片库访问、管理与界面复用协议

本文件是 Zotero PDF Image Saver 与 Rough PPT Add-in 的完整图库对齐合同。数据库字段和通信安全边界继续以 PPT 仓库的 `docs/ZOTERO_EXTERNAL_DATABASE_PROTOCOL.md` 为准；本文件冻结图库如何生成、如何打开、哪些操作由谁执行，以及 PPT 如何复用同一界面。

## 1. 唯一数据源与界面所有权

- 唯一图片库是 `%LOCALAPPDATA%\ZLK\paper-image-library\paper_images.sqlite`。
- `images.image_blob` 是图库、下载、高清查看和 PPT 插图共同使用的原图字节；不得另建缩略图库、预览数据库或图片 HTTP 接口。
- Zotero 插件是完整图库界面的唯一实现方。界面由 `buildGlobalImageLibraryHTML()` 生成，当前 `GLOBAL_LIBRARY_VIEW_VERSION` 为 `45`。
- **PPT 插件必须复用 Zotero 生成的完整图库界面。** PPT 不得另写一套完整图库的卡片、表格、筛选、排序、高清查看、批量选择、分享、导入或删除界面，也不得把生成页的 HTML、CSS 或 JavaScript 复制进 PPT 仓库形成分叉版本。
- PPT 可保留任务窗格内服务于“快速搜索、取色、插入当前图片”的轻量选择器；它不是完整图库，不得替代或复制本文件定义的完整图库管理界面。

## 2. 当前访问入口

Zotero 内所有完整图库入口最终调用 `openGlobalImageLibrary()`：

| 位置 | 中文入口 | 范围 |
| --- | --- | --- |
| PDF 阅读器工具栏 | `本篇图片` | 打开同一完整图库，并以当前 PDF 附件键作为初始范围 |
| PDF 阅读器工具栏 | `全部图库` | 打开全部活动图片 |
| Zotero 工具菜单 | `打开全部论文图片库` | 打开全部活动图片 |
| PDF 阅读器右键菜单 | `打开全部论文图片库` | 打开全部活动图片 |
| 生成的图库网页 | `刷新图库` | 请求运行中的 Zotero 重新读取 SQLite、重建同一路径并刷新页面 |

PPT 的完整图库入口统一命名为 `打开论文图片库`，并按第 8 节打开同一个生成文件。PPT 不得把任务窗格现有快速选择器改名为完整图库。

## 3. 生成文件与路径

Zotero 每次打开或刷新完整图库时执行：

1. 只查询 `images` 中 `deleted = 0` 的活动记录。
2. 先读取元数据，再逐条读取有界 `image_blob`；单图上限为 25 MB。
3. 原样把图片字节写入临时 `images/` 目录，不重新编码、不生成缩略图。
4. 写入一份完整图库 HTML，图片使用相对路径。
5. 由系统默认浏览器打开 HTML；也允许 PPT 的 WebView2 直接导航到同一 `file:///` URI，但不得复制或改写页面资源。

Windows 上的生成路径由 `Path.GetTempPath()` 或等价系统 API取得，固定相对结构如下：

```text
<系统临时目录>\pdf-image-saver\paper-image-library-view\
├── paper-image-library.html
└── images\
    └── image-00001-<fingerprint>.<ext>
```

典型路径为：

```text
%TEMP%\pdf-image-saver\paper-image-library-view\paper-image-library.html
```

约束：

- PPT 必须使用系统临时目录 API 拼接上述固定相对路径，不接受用户输入、注册表或任意外部路径覆盖。
- PPT 打开前必须确认最终绝对路径仍位于系统临时目录内，且文件名精确为 `paper-image-library.html`。
- 该目录是可重建临时产物，不是数据源，也不是备份。SQLite 仍是唯一真源。
- 刷新会替换 `images/` 中的临时文件；PPT 不得长期持有其中单张图片路径。插入 PPT 时仍从 SQLite 的 `image_blob` 读取原图。

## 4. 图库当前功能

完整图库统一提供：

- 中文搜索：论文标题、DOI、年份、页码、类别、色系、标签和自定义描述。
- 类别、色系、年份、来源状态筛选，以及多种排序。
- `图库` 与 `表格` 两种视图。
- 220 至 460 像素目标宽度调节和自动流式排布。
- 原图完整显示，不裁切；卡片下方显示论文、类别、年份、页码、尺寸、大小、来源、时间、配色、标签和自定义描述。
- 自定义描述：采集确认窗口可填写；图库卡片内可就地编辑并写回 SQLite；表格视图有独立 `描述` 列。上限 300 字，保留换行。
- 高清查看器：适应窗口、1:1、缩放、滚动、上一张、下一张、下载原图和定位原文；有关联描述时在标题下单独成行显示。
- 高清查看器使用页内浮层，绝不打开新的浏览器标签页；关闭控件显示 `×` 并声明返回图片库列表，关闭后焦点回到打开它的元素。
- 高清查看器由 OpenSeadragon 提供滚轮居中缩放、Ctrl 加拖动平移和左下角鸟瞰图。Fabric 仅提供笔刷、橡皮和文字标注，使用与图像相同的坐标变换；再次点击已有文字可直接编辑。快捷键 B/E/T，Esc 退出工具，Ctrl+Z 撤销。查看器标明原图是 SVG 还是位图，并直接显示导出状态或错误。SVG 原图通过浏览器原生图像层显示；导出标注时从图库桥接读取原图字节，生成自包含 SVG。生成图库页时把 UMD 脚本内联进 HTML。缺失时回退为纯图片查看。

- 框选保存不再提供清晰度挡位：PDF 绘图和文字优先保存为 SVG；纯嵌入位图选区保存高分辨率 PNG，遵守 1.5 MB 上限。
- 以 `file://` 打开图库时，浏览器会忽略 `download` 属性，直接跟随 `href` 会把整个图库页导航走。页面必须在捕获阶段拦截 `[data-download-image]` 与 `#viewer-download`，改由 `readImageBytes` 取回字节并以 Blob URL 触发下载；失败时只显示中文提示，绝不导航离开。
- 框选保存按 DPI 重新渲染，而不是裁剪阅读器屏幕上的 canvas：阅读器 canvas 通常只有约 145 DPI。低/中/高分别对应 96/150/600 DPI，高挡使用 PNG 无损编码；像素上限 16 MP，栅格字节上限 1.5 MB。阅读器重渲染失效或所得图像像素不足时，内置 PyMuPDF 从原 PDF 重新渲染纯位图选区，仅在像素更多且字节未超限时替换预览结果。
- 若 PDF 选区含绘图或文字，PyMuPDF 用 `set_cropbox` + `select` 导出真正 SVG；纯嵌入位图选区不能恢复为矢量，保留 PNG。保存提示明确标明实际格式和尺寸。
- `install:xpi` 在 Zotero 退出后将包内 Python 与 PyMuPDF 文件部署到配置目录，并用运行时版本标记和导入探针验证；这样框选助手无需系统 Python。
- 原图临时文件加载失败时，卡片、表格和高清查看器显示中文恢复提示；不生成备用图像。
- 图库和表格同步多选、Shift 连选、全选当前结果、清空选择。
- 批量分享 `.pislib`、导入 `.pislib`、批量软删除。
- `刷新图库`：重新读取固定 SQLite 并重建当前生成页。
- 本机文献存在时定位 PDF 或条目；分享包导入后未匹配文献时只显示文献信息，不伪造跳转。

所有显示文本必须使用中文母语；数据库机器值必须先映射为中文。

## 5. 读写与管理边界

| 操作 | 数据来源或命令 | 所有者 | PPT 是否可直接执行 |
| --- | --- | --- | --- |
| 搜索、预览、取色、插图 | 只读 SQLite | PPT 快速选择器或完整图库 | 可以，只读 |
| 打开完整图库 | 同一生成 HTML | Zotero 生成，PPT 复用 | 可以 |
| 刷新完整图库 | `refreshLibrary` | Zotero bridge | 可以，仅用于界面复用 |
| 定位 PDF／文献 | provenance bridge 或白名单 `zotero://` | Zotero | 可以 |
| 下载原图 | 生成页相对原图文件 | 完整图库 | 只能由复用页面执行 |
| 分享所选 | `exportImages` | 完整图库 | PPT 不得直接发送 |
| 导入分享包 | `importImages` | 完整图库 | PPT 不得直接发送 |
| 修改自定义描述 | `updateImageNote` | 完整图库 | PPT 不得直接发送 |
| 下载原图字节 | `readImageBytes` | 完整图库 | PPT 不得直接发送；以 `file://` 打开时下载必需 |
| 软删除所选 | `deleteImages` | 完整图库 | PPT 不得直接发送 |
| 直接写 SQLite | SQLite 写事务 | Zotero 插件 | 禁止 |

`refreshLibrary` 只读取 SQLite 并重建临时界面，不修改图片记录，因此是 PPT 为复用完整图库可使用的唯一图库命令。`deleteImages`、`exportImages`、`importImages`、`readImageBytes`、`updateImageNote` 仍只属于生成页。

`updateImageNote` 是唯一由用户手写内容的写命令：它只更新 `images.user_note`，其余列仍由采集和导入路径独占。

## 6. Bridge 合同

固定 endpoint：

```text
POST http://127.0.0.1:23119/pdf-image-saver/bridge
```

PPT 从同一 SQLite 的 `bridge_state` 读取 `token`、`status`、`endpoint`。只有 token 非空、状态为 `ready` 且 endpoint 匹配固定值时才发送请求。

PPT 为刷新完整图库发送：

```text
Content-Type: application/x-www-form-urlencoded; charset=utf-8
X-Rough-Ppt-Token: <token>

token=<token>
command=refreshLibrary
pdf_attachment_key=<可选的当前 PDF 附件键>
```

成功响应至少包含：

```json
{
  "ok": true,
  "registered": true,
  "imageCount": 12,
  "skippedCount": 0,
  "totalBytes": 3456789
}
```

图片字节绝不通过 bridge 请求或响应传输。

## 7. 在线、离线和失效状态

| 状态 | 完整图库行为 | PPT 快速选择器行为 |
| --- | --- | --- |
| Zotero 运行且 bridge 就绪 | 可刷新、管理、定位来源 | 从 SQLite 正常读取 |
| Zotero 运行但 token／endpoint 无效 | 生成页降级只读；提示从 Zotero 重新打开 | 从 SQLite 正常读取；来源操作走白名单 fallback |
| Zotero 已关闭且生成 HTML 仍存在 | 可打开最后生成版本；搜索、查看、下载可用，刷新、描述编辑和批量管理禁用 | 从 SQLite 正常读取、取色和插图 |
| 生成 HTML 不存在 | 完整图库入口显示中文说明，要求启动 Zotero 后重试 | 从 SQLite 正常读取，不得临时生成另一套完整图库 |
| SQLite 不存在或不可读 | 完整图库不可生成 | 保留 UI 状态并显示中文只读错误；禁止访问 `zotero.sqlite*` |

浏览器页面不能直接读取 SQLite。页面上的 `刷新图库` 必须依赖运行中的 Zotero bridge；离线页面不会假装刷新成功。

## 8. PPT 复用流程

PPT 的 `打开论文图片库` 必须执行以下顺序：

1. 按冻结 locator 规则确认共享 SQLite，不读取 Zotero profile。
2. 用系统临时目录 API计算第 3 节的固定 HTML 路径。
3. 若 bridge 就绪，发送 `refreshLibrary`；成功后再打开 HTML。
4. 若 bridge 不可用但 HTML 已存在，允许以只读方式打开最后生成版本，并明确提示内容可能不是最新。
5. 若 HTML 不存在，显示中文恢复说明：启动 Zotero，使用 `全部图库` 生成页面后重试。
6. 使用系统默认浏览器，或让 WebView2 直接导航到同一 `file:///` URI。不得把页面源复制到 PPT 资源目录，不得注入另一套样式或业务脚本。
7. PPT 快速选择器继续直接读取 SQLite 以保证 Zotero 关闭时仍可预览、取色和插图；完整管理统一回到复用页面。

## 9. 禁止事项

- 禁止 PPT 创建第二份完整图库 UI 或长期维护 Zotero 图库的 HTML/CSS/JS 副本。
- 禁止 PPT 通过 DOM 选择器自动操纵生成页；PPT 只负责导航到页面，页面内部交互由页面自身处理。
- 禁止把临时 HTML 或 `images/` 当作数据库、缓存协议或插图字节来源。
- 禁止 PPT 发送 `deleteImages`、`exportImages`、`importImages`、`readImageBytes`、`updateImageNote`。
- 禁止增加图片 HTTP endpoint、随机端口、WebSocket 或未文档化文件消息。
- 禁止读取、复制、锁定或修改 Zotero 内置 `zotero.sqlite*`。
- 禁止为了 PPT 兼容放宽固定数据库路径、token 校验、URI 白名单或分享包校验。

## 10. 变更与验证

- Zotero 修改完整图库结构、管理动作、生成路径或 bridge 命令时，必须同步更新本文件和 PPT 仓库的 `docs/ZOTERO_EXTERNAL_DATABASE_PROTOCOL.md`。
- PPT 修改论文图库入口时，必须验证它打开的是本文件定义的同一生成 HTML，而不是 PPT 自己的完整图库实现。
- `GLOBAL_LIBRARY_VIEW_VERSION` 只用于诊断和缓存识别；PPT 不得按版本复制页面实现或依赖内部 DOM。
- 生成页整体由一个外层模板字符串构建，因此页面内嵌脚本有两条硬约束：不得嵌套模板字符串（反引号会截断外层），且正则与字符串里的反斜杠必须写成 `\\`（否则外层模板会把 `\n`、`\t` 当成转义序列吃掉，页面脚本整体语法失效而标记看起来仍然正常）。
- `tests/current-release.test.js` 会逐个解析每份生成页的 `<script>`，语法失效必须在此拦截，不得靠人工目视。
- `scripts/audit-index-buttons.mjs` 断言审计期间不产生新的浏览器 page target：任何把用户送出当前页面的改动都会在这里失败。
- Zotero 验证：`npm.cmd test`、`npm.cmd run check`、`npm.cmd run audit:index-buttons`。
- PPT 验证：`node scripts/validate-zotero-image-library.mjs`、`node scripts/validate-external-plugin-compat.mjs`。
