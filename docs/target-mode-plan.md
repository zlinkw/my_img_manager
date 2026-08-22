# 目标模式计划

> 仅保留当前状态快照，不作为后台自动执行计划。修改受 `PROJECT_CONSTRAINTS.md` 约束。按约定压缩重写，不追加批次流水。

## 当前状态

- 版本 `0.1.129`；插件 ID `pdf-image-saver@zlk.local`；`strict_max_version: 9.*`。
- 交付包：开发交接为带时间戳的 recovery 包，公开 Release 为稳定命名 `outputs/pdf-image-saver-0.1.129.xpi`；均由 `scripts/build.ps1` 生成并经 `scripts/check-xpi.ps1` 校验。
- 冻结合同：SQLite schema 2；locator schema 1；producer `zotero-pdf-image-saver`；`GLOBAL_LIBRARY_VIEW_VERSION = "37"`；bridge `POST http://127.0.0.1:23119/pdf-image-saver/bridge`。
- PPT 仅可调用 `refreshLibrary` 与冻结的来源定位命令；不得发送 `deleteImages`、`exportImages`、`importImages`。
- 保护区：已安装 XPI、用户 Zotero profile、`zotero.sqlite*`、外部 SQLite、PPT 仓库。
- 闸门：`npm.cmd run check` = 单元／静态检查 + PPT 侧 `validate-zotero-image-library.mjs` + 无头 Chromium UI 审计；后两者在缺少 PPT 仓库或浏览器时显式跳过而非失败。

## 已关闭的遗留问题（2026-07-26）

- 交付链：脚本曾硬编码 `pdf-image-saver-0.1.0.xpi`——既是旧版本又带反斜杠 ZIP 条目（0.1.128 修复的正是该故障），`install:xpi` 会把它装进用户 profile。现统一由 `scripts/current-xpi.ps1` 按 `manifest.json` 解析，安装前先跑 `check-xpi.ps1`，静态检查禁止再硬编码文件名。
- UI 审计：`audit:index-buttons` 自恢复批次起全程失败，因夹具退化（图库仅 1 条记录、离线图库为空、预览图不可解码、多图索引丢失文献页码与 `auto` 类别）。夹具已重建为 8 条记录 + 离线图库 + 单／多图索引，形状由 `tests/current-release.test.js` 断言锁定；审计脚本自身的移动端焦点断言、设置页夹具与偏好断言已对齐当前实现。**该窗口内的所有 UI 批次都未经真实 DOM 验证。**
- 用户可见措辞：补齐 8 条只有英文的内部错误；9 类带运行时数值的错误改为定向模式翻译；诊断四处"中文前缀 + 原始英文"改为先翻译再拼接；组合错误按已知前导片段匹配。覆盖率由测试中的抛错全量扫描保证。
- 设置页：修复异常值时列出被修复项并说明当前显示即生效值；越界输入提示写明原输入与实际保存值。
- 页码措辞：`formatPageWithLabel()` 成为唯一来源，诊断不再输出缺单位的 `页面：第 8`。
- 分享边界：`.pislib` 构建为白名单，复核确认不含 `parent_item_key`、`pdf_attachment_key`、`library_id`、`group_id` 与 `zotero://`。已补非空洞测试（先断言这些标识确实在源记录上），并覆盖导入的格式／版本／`includes_pdf`／空包拒绝措辞与 gzip 往返。
- `恢复审计报告_20260721.md` 对 `audit-index-buttons.mjs` 的"非最终版本"标记已失效，状态以当前实现和 README 为准；报告仅作历史记录。

## 已关闭的更新与公开发布批次

- 工具菜单和设置页提供中文“检查更新”；后端只读 GitHub Latest Release，拒绝 draft/prerelease，按语义化版本比较，并通过安全 HTTPS 发布页交给用户在插件管理器安装。不执行 Git 快进、不覆盖自身、不自动重启。
- 原生更新源指向 `master/updates.json`；`.github/workflows/release.yml` 在 Windows runner 构建稳定 XPI 和 SHA256，并创建 GitHub Release。
- README 重写为公开使用文档，覆盖 Zotero 9 要求、Release 安装校验、更新方式、框选流程、图库管理、数据边界、PPT 协议和发布步骤。

## 下一步

- 无进行中的批次。新工作需由明确的用户请求加 `PROJECT_CONSTRAINTS.md` 驱动，不得由后台自动规划产生。
