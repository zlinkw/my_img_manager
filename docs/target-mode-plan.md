# 目标模式计划

> 仅保留当前状态快照，不作为后台自动执行计划。修改受 `PROJECT_CONSTRAINTS.md` 约束。按约定压缩重写，不追加批次流水。

## 当前状态

- 版本 `0.1.134`；插件 ID `pdf-image-saver@zlk.local`；`strict_max_version: 9.0.*`。
- 交付包由 `scripts/build.ps1` 生成并校验；开发用带时间戳 recovery 包，公开发布用 `pdf-image-saver-<version>.xpi`。
- 冻结合同：SQLite schema 2；locator schema 1；producer `zotero-pdf-image-saver`；`GLOBAL_LIBRARY_VIEW_VERSION = "37"`；bridge `POST http://127.0.0.1:23119/pdf-image-saver/bridge`。
- PPT 仅可调用 `refreshLibrary` 与冻结的来源定位命令；不得发送 `deleteImages`、`exportImages`、`importImages`。
- 保护区：已安装 XPI、用户 Zotero profile、`zotero.sqlite*`、外部 SQLite、PPT 仓库。
- 闸门：`npm.cmd run check` = 单元／静态检查 + PPT 侧 `validate-zotero-image-library.mjs` + 无头 Chromium UI 审计；后两者在缺少 PPT 仓库或浏览器时显式跳过而非失败。

## 已关闭事项

- 历史交付链、UI 审计夹具、错误翻译、设置页修复提示、页码措辞、分享白名单和离线发布边界均已关闭。`0.1.131` 已补齐阅读器菜单键盘操作和图库加载失败提示。
- 在线更新入口、GitHub Actions 发布工作流、`updates.json` 和更新检查模块保持移除。

## 当前目标

- 当前无待执行批次。继续工作需由新的用户请求、运行时反馈或明确 UI 缺口驱动。

## 已完成批次（2026-08-24）

- 批次 `failure-feedback-prefs-0.1.132`：设置页 Python 选择器不可用时给出中文手动路径指引；统一高级设置默认值；图库在监听器建立前已失败的原图也会进入失败态，失败期间禁用下载原图并在成功后恢复。范围仅限偏好页、完整图库反馈、测试审计与发版号。
- 验收：`npm.cmd test`、`git diff --check`、`npm.cmd run check`、`npm.cmd run build`；通过后提交并推送 `origin/master`，再按用户既有约定在 Zotero 关闭时安装当前 XPI。
- 复查：无头 Chromium UI 审计通过，并抽查当前论文索引、图库、表格、高清查看器、移动图库、离线管理态、偏好页和确认对话框截图；未发现可安全继续处理的明确 UI 或功能逻辑改进点。
- 批次 `profile-install-compat-0.1.133`：将 Zotero 安装范围修正为 `9.0.*`，同步约束、README、检查和测试；避免运行时拒绝兼容声明。
- 批次 `silent-profile-install-0.1.134`：新增 XPI 注册辅助脚本并接入 `install:xpi`；修复移动宽度下图库按钮越界。实际 Zotero 配置显示 `0.1.134` 已注册启用，bridge `ready`；安装包与 profile XPI SHA256 一致。
- 验收：`npm.cmd test`、`git diff --check`、`npm.cmd run check`、`npm.cmd run build`；实际前端已通过 bridge 重建并用 390 像素视口复查，批量按钮完整显示。
