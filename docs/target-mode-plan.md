# 目标模式计划

> 仅保留当前状态快照，不作为后台自动执行计划。修改受 `PROJECT_CONSTRAINTS.md` 约束。按约定压缩重写，不追加批次流水。

## 当前状态

- 版本 `0.1.131`；插件 ID `pdf-image-saver@zlk.local`；`strict_max_version: 9.*`。
- 交付包由 `scripts/build.ps1` 生成并校验；开发用带时间戳 recovery 包，公开发布用 `pdf-image-saver-<version>.xpi`。
- 冻结合同：SQLite schema 2；locator schema 1；producer `zotero-pdf-image-saver`；`GLOBAL_LIBRARY_VIEW_VERSION = "37"`；bridge `POST http://127.0.0.1:23119/pdf-image-saver/bridge`。
- PPT 仅可调用 `refreshLibrary` 与冻结的来源定位命令；不得发送 `deleteImages`、`exportImages`、`importImages`。
- 保护区：已安装 XPI、用户 Zotero profile、`zotero.sqlite*`、外部 SQLite、PPT 仓库。
- 闸门：`npm.cmd run check` = 单元／静态检查 + PPT 侧 `validate-zotero-image-library.mjs` + 无头 Chromium UI 审计；后两者在缺少 PPT 仓库或浏览器时显式跳过而非失败。

## 已关闭事项

- 历史交付链、UI 审计夹具、错误翻译、设置页修复提示、页码措辞、分享白名单和离线发布边界均已关闭，以当前测试、审计和协议文档为准。
- 在线更新入口、GitHub Actions 发布工作流、`updates.json` 和更新检查模块保持移除。

## 当前目标

- 继续按用户请求自查 UI 与现有功能逻辑，优先处理可验证的用户可见清晰度、反馈、键盘和状态问题；无明确改进点时停止。

## 已完成批次（2026-08-24）

- 批次 `ui-feedback-keyboard-0.1.131`：补齐阅读器工具栏下拉的方向键、Home、End 和 Esc 操作；为卡片、表格和高清查看器的原图加载失败提供中文恢复提示。范围仅限阅读器控件、完整图库查看器、测试审计与发版号；SQLite schema 与 bridge 合同保持 `37` 版视图不变。
- 验收：`npm.cmd test`、`git diff --check`、`npm.cmd run check`、`npm.cmd run build`；通过后提交并推送 `origin/master`，再按用户既有约定在 Zotero 关闭时安装当前 XPI。
