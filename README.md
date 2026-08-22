# PDF 图片保存

Before modifying this project, read [PROJECT_CONSTRAINTS.md](PROJECT_CONSTRAINTS.md). It is the active project contract and explicitly disables background agents, target-mode loops, and autonomous review/planning agents for this repository.

Optimization priority: improve UI first until remaining UI work is exhausted, then optimize non-UI features. See the Optimization Priority section in [PROJECT_CONSTRAINTS.md](PROJECT_CONSTRAINTS.md).

Zotero 插件：从 PDF 阅读器框选科研图片，保存至固定外部 SQLite 原图库，并提供与 PPT 插件复用的完整图库界面。

## Features

- Runs independently inside Zotero by using the rendered PDF reader canvas.
- 阅读器工具栏、确认窗口、设置页、当前论文索引和全局图库统一采用 SimpleExperiment 的扁平色板与按钮体系：浅色界面使用灰蓝页面、白色内容面、深色正文、蓝色主操作及绿／橙／红语义色；暗色界面保持同一语义。标准按钮为 32 像素，紧凑工具栏和菜单为 28-30 像素，圆角和内边距统一；所有界面禁止渐变。
- Zotero 启动时会补渲染已恢复、已打开的 PDF 阅读器；无需关闭并重新打开 PDF 才能使用插件功能。
- 工具栏“框选保存”会让当前 PDF 页先变暗。框选输入会先于 PDF 阅读器自身的选词／拖动处理；按住左键拖动时，绿色虚线框会逐次跟随鼠标，框内保持正常亮度；范围小于 12 × 12 像素时不会退出框选，而会恢复暗化并提示直接重试。松开有效范围后，工具栏会依次显示“等待确认”和“保存中…”，整个确认与写入过程都不会提前解锁其它采集操作。即使阅读器恢复布局、重建工具栏或切换全屏，新工具栏也会继承当前阶段，不会错误恢复为空闲。只有点击“确认并保存”才会入库；取消、失败或保存完成后才恢复工具栏。确认窗口使用中文显示识别进度、图片信息、类别和 PPT 用途；保存操作始终停留在窗口底部，暗色模式保持可读，点击窗口外不会误跳过图片。框选期间会暂时禁用 PDF 选词和选词翻译，按 Esc 或右键可取消框选。
- 清晰度与图片类别采用单击展开的中文菜单；按下菜单选项时立即应用并保存，不会被菜单收起或窗口失焦抢先打断；再次点击工具栏、PDF 页面或阅读器其它区域会自动关闭。跨阅读器文档的外部点击也会被识别，工具栏控件显式退出 Zotero 可拖动标题栏，不会再要求双击。
- 阅读器工具栏按全屏使用设计，固定显示清晰度、框选保存、本篇图片和全部图库。采集操作位于前方；“本篇图片”只回看当前论文，“全部图库”用于跨论文筛选和管理。类别在每次预览确认时修改，因此不占用工具栏。缩小窗口布局不作为支持目标。
- 全局图库搜索或筛选没有结果时，空状态直接提供“清除筛选并显示全部”，一次恢复全部图片并把键盘焦点放回搜索框。
- 工具栏“本篇图片”会在浏览器打开当前论文已保存图片；“全部图库”会打开跨论文图片库。工具菜单和阅读器右键菜单保留相同的两个明确入口。全局图库直接解包并复用 `image_blob` 完整字节，不生成另一套图库缩略图。图片目标宽度可在 220-460 px 调整并自动决定每行数量，控件会实时显示“每行最多 N 张”，窄窗口自动缩小，设置会在本机保留；图片完整显示、不裁切，选择框和尺寸信息位于图片下方，不会遮挡原图。搜索、筛选、视图切换和普通操作按钮在明暗主题下均保持清晰边界，不会与页面背景混在一起。每张卡片显示论文、类别、年份、页码、尺寸、大小、来源匹配、保存时间、配色和标签。卡片与高清查看器的“下载原图”统一使用“论文标题_年份_第 N 页_图序号.扩展名”的安全文件名，悬停可在下载前确认，离开图库后仍能辨认来源。高清查看器同步显示类别、年份、原文页码、像素尺寸、文件大小和来源状态，支持适应窗口、1:1 原始像素、有界放大缩小和滚动检查细节；上一张／下一张按钮带方向标记，按钮提示和无障碍信息明确说明左右方向键切图、加减号缩放、数字 1 原始像素、数字 0 适应窗口及 Esc 关闭。窄屏页头会把论文信息与批量操作分成上下两行，标题和图片事实不再被按钮挤压。查看过程中可直接把当前图片加入或移出批量选择，紧邻选择框的徽标会实时显示全部已选图片数量，状态与图库、表格同步。存在选择时“关闭”会变为“完成选择”，点击后直接显示并聚焦批量分享区域；Esc 和无选择时的普通关闭仍返回原图片。未匹配到本机文献时明确显示“无本机文献”，上一张／下一张不会打断键盘焦点。支持搜索、类别／色系／年份／来源筛选、多种排序、图库／表格、原图下载和定位原文；图库／表格选择会在本机保留，并支持方向键、Home 和 End 键切换。桌面筛选区首次打开默认收起，让图片更早进入首屏；单击“展开筛选”即可使用全部条件，之后会在本机保留用户选择的展开或收起状态。重新展开后焦点直接进入类别选择，当前搜索词、筛选摘要和条件保持不变。仅使用搜索时，折叠摘要也会显示完整搜索词，不再错误显示“未筛选”；完整条件保留在提示中。表格模式把图像列明确命名为“预览”，每行只显示可点击缩略图，不再重复一列“查看大图”文字；缩略图的中文悬停提示、无障碍名称和可点击论文标题仍完整保留，关闭查看后焦点返回原入口。表格模式会隐藏只对图库生效的图片宽度设置，宽屏滚动时列标题会停在实际页头下方。窄屏表格改为选择、预览、论文信息和来源四列，类别、年份、页码、大小与来源状态合并到论文信息内，无需横向滚动且不会丢失元数据。窄屏折叠筛选会直接显示当前搜索词、类别、年份、来源或排序，多条件时显示首项和总数，完整条件保留在提示中。窄屏还会保留搜索框，未选择图片时隐藏不可用的批量按钮，页头随页面滚动离开，优先把空间留给图片。
- 全局图库支持图库与表格双向同步多选、全选当前结果、批量软删除、批量分享和图片包导入。桌面批量操作行在尚未选择图片时只保留可立即执行的“全选当前”和“导入图片包”；勾选后才显示带精确数量的清空、分享、删除和选择摘要，清空后自动收回。电脑端先勾选一张，再按住 Shift 勾选另一张，可按当前筛选和排序连续选择或取消整个区间，并显示本次连续操作张数；图库与表格状态同步。窄屏首次打开时改为说明选中后使用底部固定栏，复选框提示和无障碍名称也同步改为触摸操作，不再显示无关的 Shift 操作；实际操作反馈出现后不会被窗口尺寸变化覆盖。“全选当前 N 张”和“取消当前 N 张”直接显示筛选结果范围；空结果显示 0 张并禁用。分享和删除按钮会直接显示实际处理张数；Zotero 管理连接不可用时，图库、表格、高清查看器的选择入口以及全选、分享、删除和导入均保持禁用，并说明保持 Zotero 运行及从 Zotero 重新打开图库的恢复方法，不再让用户进入没有后续操作的选择流程。图库打开后若 Zotero 被关闭、端点失效或令牌过期，也会立即清空未完成选择并原地切换为同一只读状态；普通命令错误不会误判为断线。搜索、筛选、查看大图、下载原图和定位来源仍可使用。暗色模式会同步提高危险操作、当前筛选摘要、已选卡片边框和“选择图片”状态的对比度，避免操作范围难以辨认，同时保持蓝色实心主按钮原有可读性。取消当前选择只清除当前筛选内的图片，筛选外选择保留。窄屏选中图片后，底部固定栏持续显示选择总数，并可直接清空、分享或删除；固定栏为最后一行内容预留空间，高清查看器“完成选择”会直接把焦点移到这里。查看器的选择框还会明确显示“加入批量”“移出批量”或“批量不可用”，不用仅靠复选框状态猜测下一步。切换筛选条件后会保留已有选择；若部分已选图片位于当前筛选结果外，选择摘要、按钮提示、无障碍名称和删除确认都会明确显示隐藏数量，避免误操作不可见图片。`.pislib` 分享包包含原始图片及独立元数据，不包含 PDF、Zotero 条目或本机定位 ID。导入先按 DOI、再按唯一标题与年份匹配本机 Zotero；未匹配图片仍可正常查看和筛选，但不提供错误的自动跳转。SHA-256 用于完整性校验和重复导入拦截。
- 当前论文与全部图片库均直接读取外部 SQLite 原图；不再创建 HTML 预览索引、临时 HTML 预览副本或缩略图。桌面端图片库直接复用数据库原始字节，来源定位、筛选、批量操作和高清查看器保持可用。
- “自动判断”只表示设置或保存确认前的推断动作。旧索引或历史数据库中仍保留 `auto` token 的已保存图片统一显示为“未分类”，不会误导为后台仍在识别；内部 token、筛选值和共享数据不变。
- 确认窗口会明确区分框选和整页图片。窗口内可重新选择实际数据库保存画质，切换后立即重新渲染并显示最终尺寸、预计体积和真实压缩效果；确认后只把当前显示的版本写入 `image_blob`。类别与 PPT 用途仍可修改，键盘焦点从保存画质开始，Esc 可取消。
- 若设置中选择的具体初始类别与当前图片识别结果不同，确认窗口会同时显示“设置预填”和“识别建议”，解释下拉框与识别结果为何不同；使用推荐的“自动判断”且没有冲突时只保留一条简洁识别建议。
- 自动类别优先读取框选区域上方或下方距离最近的显式图／表标题，其次读取正文引用段落；表格标题位于表格上方、图片标题位于图片下方时均可识别。科研类别包含指标／训练曲线、热图／矩阵图、柱状图、分布／降维图、定性结果对比、网络结构、方法流程、科研表格、公式和医学影像，并保留旧类别兼容。
- “PDF 图片插件诊断”按“运行与存储／采集设置／高级原图提取／当前文献／提示”分段，使用中文说明运行状态、固定外部数据库路径及文件是否存在、`library.json` 发现文件及文件是否存在、冻结的数据库 schema 2 与发现文件 schema 1、确认窗口初始类别、Python 状态、临时文件和原文定位信息；文件存在只表示已找到文件，不冒充 schema 可读性。路径校验会明确拒绝 Zotero 内部数据库。具体类别会标为“直接预填”，类别推断会说明先图注、后正文引用。Python 路径为空时显示“自动查找”。
- 设置页每次打开都会重新读取当前偏好，因此阅读器工具栏或其它入口刚修改的清晰度等设置会立即同步，同时不会重复绑定事件。顶部会明确提示修改后自动保存，并在每次变更后显示具体设置已保存；写入失败时改为可见错误，不会假装成功。“确认窗口初始类别”明确说明：“自动判断”会先读图注、再参考正文引用；选择具体类别只会预填每次确认窗口，保存前仍可修改。仅用于 Python/PyMuPDF 的“高级原图提取”默认收起，并明确提示常规采集无需配置，单击后仍可使用全部参数和资源管理器选择。打开时还会修复旧版本遗留的未知清晰度、未知类别、字符串布尔值和异常数值，避免下拉框空白或开关状态误判；发生修复时顶部提示会直接列出被修复的设置名称（超过三项显示前三项和总数）并说明当前显示的就是生效值，不再静默改写用户设置。手动输入超出允许范围的数值时，提示会写明原输入和被改成的值，例如“已自动保存：每页最多原图数；输入的“4000”超出允许范围，已改为 500。”；范围内的输入按原值保存，不会谎称被调整。
- 阅读器右键菜单把当前默认清晰度的“框选保存”放在首位，同时保留另外两档清晰度；框选和整页预览都会明确显示初始类别。整页预览依次显示“整页生成中”“整页待确认”和“整页保存中”，确认前不会误报正在保存。“工具”菜单启动框选时也使用相同阶段。
- Writes each saved preview into the canonical external SQLite library at `%LOCALAPPDATA%\ZLK\paper-image-library\paper_images.sqlite` for PPT search, palette extraction, preview, insertion, provenance, and local sharing. New records store original bytes once in `image_blob`; the gallery reuses that payload directly.
- Zotero 关闭时由原生插件生命周期触发幂等清理：注销本地桥接、写入停止状态、移除阅读器界面并显式关闭外部 SQLite 连接；应用退出观察器、主窗口卸载和 bootstrap 到达时共用同一个清理任务，最后一个主窗口卸载和 APP_SHUTDOWN bootstrap 都只启动清理而不阻塞原生窗口销毁，避免外部 SQLite 较慢时残留只有标题栏的空白横条。插件不拦截原生关闭事件，也不二次调用 `window.close()`。`smoke:close` 和 `smoke:close:isolated` 都只把本插件装入预置屏幕外位置的全新临时 profile 和空数据目录，再向主窗口发送一次标准关闭请求；自动验证不会启动用户 profile，不会读取、复制或修改用户的 `zotero.sqlite*`，失败清理也不会另启可能生成空白横条的 `zotero -quit` 进程。
- 若刚启动 Zotero 后关闭时出现约 315 × 89 的“进度”空白横条，应检查 Better BibTeX 的启动任务。PDF 图片保存不创建 `Zotero.ProgressWindow`；独立临时配置连续关闭用于区分本插件退出与其它插件仍在启动的情况。
- 完全不安装任何插件的临时配置在正常退出时也会短暂显示无标题的 `MozillaDialogClass` 小横条；这是 Zotero 原生退出过渡窗。PDF 图片保存不会拦截或强制关闭该窗口，诊断只关注它是否长期不消失，以及是否同时存在其它插件命名的窗口。
- Optional helper can try PyMuPDF original image extraction when Python is present, but the main workflow does not depend on it.
- Zotero 启动时会递归创建固定共享库目录并初始化 SQLite schema，随后发布同目录 UTF-8 `library.json`；首次保存前即可完成数据库初始化。No alternate database path or legacy locator is supported.

## Runtime Independence

The XPI carries the JavaScript needed for the primary workflow and uses Zotero's bundled PDF.js runtime plus the already-rendered reader canvas. It writes the fixed external SQLite library; a new user needs no conda environment, Python interpreter, PyMuPDF install, network download, or separate runtime for clipping, SQLite publishing, or PPT library use.

The bundled Python file is only an optional helper for explicit raw embedded-image extraction. If it is needed, the preferences page can open the system file picker to select `python.exe`, and automatic discovery checks the active `CONDA_PREFIX`, common Conda roots, a `zlk` environment, environment variables, and `PATH`. If Python or PyMuPDF is missing, clipping still works and helper status shows as n/a.

## Preview Quality

- Low: max width 240 px, about 20-80 KB per image.
- Medium: max width 480 px, about 60-220 KB per image.
- High: max width 960 px, about 180-750 KB per image.

Default toolbar action uses Medium.

框选来源是 Zotero 已渲染的 PDF canvas，因此保存结果本质上是位图。把位图包进 SVG 不会恢复 PDF 矢量路径，也不会提高真实清晰度；本项目直接保存原始图像字节，保持 PPT 端兼容性。

## Optional Original Extraction

Original embedded image extraction is an advanced optional action and may require Python plus PyMuPDF. Clipping remains usable when helper is n/a. Use Preferences > 高级原图提取 > 选择 python.exe… to select an interpreter through the system file picker when automatic discovery does not find one.

```powershell
python -m pip install --user PyMuPDF
```

The helper discovery also checks the local conda `zlk` environment first when present.

## Development

```powershell
npm.cmd run check
npm.cmd run audit:index-buttons
npm.cmd run build
npm.cmd run package:manual
npm.cmd run verify:manual
npm.cmd run install:global
npm.cmd run install:xpi
npm.cmd run runtime:status
npm.cmd run smoke:preflight
npm.cmd run smoke:wait
npm.cmd run smoke:close
npm.cmd run smoke:close:isolated
```

Zotero 专用协议闸门也可在 PPT 仓库单独执行：

```powershell
Push-Location D:\GitRepo\my_ppt_app
node scripts\validate-zotero-image-library.mjs
Pop-Location
```

当 `D:\GitRepo\my_ppt_app` 存在时，`npm.cmd run check` 会自动运行同一个 Zotero 专用协议闸门；PPT 仓库不存在时仅明确跳过，不影响没有该协作仓库的安装者。该检查不运行会被外部 ZLK Cluster 状态拖红的聚合兼容脚本。

`npm.cmd run check` 同时执行单元／静态检查和独立无头 Chromium UI 审计，真实触发阅读器菜单、框选遮罩、确认窗口、设置页、当前论文索引、图库、表格、筛选、查看器及批量管理交互。发布批次不再只依赖按钮文本或 CSS 搜索判断界面可用性。审计固定使用 `tests/current-release.test.js` 生成的夹具：8 条图库记录、单图与多图当前论文索引各一份，以及同样记录的离线只读图库；夹具形状由同一测试断言锁定，避免审计因夹具退化而静默失去覆盖。

本机未安装 Edge 或 Chrome 时，`npm.cmd run check` 只显式跳过 UI 审计并继续其余检查；单独运行 `npm.cmd run audit:index-buttons` 仍要求存在浏览器。

`npm.cmd run check` 还会解析 `manifest.json` 的版本并核对 `outputs` 中的安装包：所有交付脚本都不再硬编码某个版本的 XPI 文件名，检查会在发现其它版本遗留包时明确列出。

`validate-external-plugin-compat.mjs` 同时检查 ZLK Cluster 与 Zotero；若只报告外部 ZLK 目标计划漂移，不能归因于 PDF 图片保存或放宽本地数据库约束。

需要截图证据时使用 `node scripts/audit-index-buttons.mjs --screenshot-dir <目录>`。与 PPT 插件的界面验证一致，脚本启动独立临时配置的无头 Chromium，固定 CDP 视口并从渲染表面捕获实际 DOM；不会读取用户桌面、前台窗口或受正在进行的操作影响。`npm.cmd run smoke:close` 只会启动预置屏幕外位置的临时 Zotero profile，并在退出后删除整个临时目录；它不会再启动或移动用户 profile，因此不会改写 Zotero 全屏状态或由自动测试制造残留空白横条。

## Manual Installation

Use the manual package command for the handoff build:

```powershell
npm.cmd run package:manual
```

It rebuilds the XPI, validates the payload, and prints the exact XPI path, SHA256, file size, Zotero manual install steps, and post-install verification commands.

Install the printed XPI through Zotero's add-on manager:

1. Zotero: Tools > Add-ons.
2. Gear menu > Install Add-on From File...
3. Select the printed `outputs\pdf-image-saver-<版本>-recovery-<时间戳>.xpi` file. 每次构建都会生成带时间戳的新文件而不覆盖旧包，因此务必使用命令打印的那一条路径。
4. Confirm the install if Zotero prompts.
5. Restart Zotero if Zotero requests it.

After Zotero starts, run:

```powershell
npm.cmd run verify:manual
npm.cmd run smoke:wait
npm.cmd run smoke:preflight
npm.cmd run runtime:status
```

`verify:manual` is read-only. It summarizes the packaged XPI, Zotero 9.x registration readiness, install mode, rescan note, temp children, and the next action.

The global install script writes a Zotero extension proxy file into each detected Zotero profile for development testing. Restart Zotero to load a newly installed proxy. A manual XPI install cannot coexist with that same-ID proxy: close Zotero and run `npm.cmd run install:xpi` to switch to the packaged source before retrying manual installation.
`install:xpi` is a profile XPI fallback for testing the packaged plugin rather than the development proxy; close Zotero before running it so the installer can switch the source cleanly. On Zotero 9.x, manual add-on manager installation is the preferred package handoff until the copied-profile-XPI fallback is verified.
`runtime:status` reports whether the proxy is installed, whether the proxy target manifest is readable, whether expected payload files exist, whether Zotero has registered the add-on in the current session, whether startup cache/UUID hints exist, and whether temp files remain.
If `runtime:status` reports `rescan.needsRescan: true` for a development-proxy install that is not registered yet, close Zotero and run `npm.cmd run install:global` once more. For manual/XPI installs that already show `registered: true`, rescan prefs are informational.

## Runtime Smoke Checklist

After Zotero has been restarted or the add-on has been reloaded:

- Optional: `npm.cmd run smoke:wait` waits until registration is ready.
- `npm.cmd run smoke:preflight` passes and reports at least one ready Zotero 9.x profile.
- `npm.cmd run runtime:status` shows `summary.readyProfiles >= 1` and `registered: true` for `pdf-image-saver@zlk.local`.
- Manual package handoff remains preferred on Zotero 9.x: Tools > Add-ons > Install Add-on From File...
- 已在 Zotero 启动前打开的 PDF 也显示工具栏和右键功能，无需重新打开。
- PDF 阅读器工具栏按“框选保存”/“本篇图片”/“全部图库”排列，并显示中文清晰度；隐藏的默认类别仍由确认窗口修正。框选按钮在框选、确认、保存、整页和原图处理阶段保持稳定宽度，完整显示中文状态而不截断。清晰度菜单单击打开，菜单内部可正常选择，点击外部关闭。
- 框选时整页变暗，虚线框内保持正常亮度，并且不触发 PDF 选词或选词翻译；松开框选和整页预览都先打开预览确认窗口，确认后才写入外部 SQLite 图片库。工具栏、阅读器右键菜单和“工具”菜单启动的采集共享同一流程状态，期间不能并发启动另一项。
- “PDF 图片插件诊断”弹窗为中文，包含可读的运行、数据库、Python、临时文件和原文定位状态。
- 设置页与采集运行时共用同一配置分支；启动时会保留旧版本误写分支中的数值和 Python 路径，不覆盖已存在的新设置。即使没有打开 PDF，“PDF 图片插件诊断”也会独立检查 Python。
- 一次手动框选只创建一条外部 SQLite `images` 记录及其调色板、溯源信息；不创建 Zotero HTML 预览附件或缩略图。
- “图片库”启动时自动读取固定外部 SQLite；历史 Zotero HTML 预览不再参与图库同步。图库不生成额外缩略图或预览文件，页面仍保留 `.pislib` 导入作为跨设备补充。220-460 px 图片尺寸滑杆与自动流式列数、搜索、类别／色系／年份／来源筛选、排序、图库／表格切换、同步多选、批量删除／分享、原图下载、高清查看器和来源定位均可操作。
- “在全部图片库查看当前论文图片”直接打开外部 SQLite 图片库，并按来源字段筛选当前论文；不创建或打开 HTML 预览附件。
- Duplicate-skip toasts distinguish session vs saved entries.
- Error toasts identify capture, helper, duplicate, byte-cap, or Zotero storage failures. 每一类内部错误都有对应中文说明；带内层原因的组合错误仍显示已知的中文解释，不会退回“详细原因请查看错误控制台”。诊断提示也先翻译再拼接中文分区前缀，因此不会出现“外部图片库：Storage failed: …”这种中英混排。带数值的错误保留具体数值，例如“大小限制：图片索引过大（12.5 MB > 8 MB），请降低清晰度后重试。”“高级原图提取失败：运行超时（高级原图提取超过 60 秒未完成，已停止）”。
- Optional original helper absence stays quiet; diagnostics show Python n/a or ok.
- 设置页分为“采集方式”与默认收起的“高级原图提取（可选）”，顶部保存提示实时说明修改已自动保存或保存失败。
- `%TEMP%\pdf-image-saver` has no leftover child directories after the save.


Saved figure metadata includes `image_category`, `color_family`, palette, `style_tags`, and `ppt_assist_token / layout_hint / aspect_ratio / slide_slot / role_hint / insert_hint / caption_hint / story_order / story_beat / dominant_hex / contrast_hex` for PPT search/color assist.
PPT consumers read only `%LOCALAPPDATA%\ZLK\paper-image-library\paper_images.sqlite`. `library.json` at the same directory contains the frozen schema version, producer, timestamp, and exactly that canonical path. The optional bridge remains `POST http://127.0.0.1:23119/pdf-image-saver/bridge`; PPT uses provenance commands only, while the generated local gallery may use its token-authenticated management commands. See [docs/IMAGE_LIBRARY_SHARING_PROTOCOL.md](docs/IMAGE_LIBRARY_SHARING_PROTOCOL.md).
