# 目标模式计划

> 仅保留当前状态快照，不作为后台自动执行计划。修改受 `PROJECT_CONSTRAINTS.md` 约束。按约定压缩重写，不追加批次流水。

## 当前状态

- 版本 `0.1.140`；插件 ID `pdf-image-saver@zlk.local`；`strict_max_version: 11.*`；`update_url` 指向仓库静态空 feed。
- `0.1.140` 修复图库查看器回退：vendor 脚本按文本从插件拷到生成页旁；矢量运行时按 `content/runtime/` 前缀读取，并去掉 manifest BOM。
- 冻结合同：SQLite schema 3；locator schema 1；producer `zotero-pdf-image-saver`；`GLOBAL_LIBRARY_VIEW_VERSION = "40"`；bridge `POST http://127.0.0.1:23119/pdf-image-saver/bridge`。
- PPT 仅可调用 `refreshLibrary` 与冻结的来源定位命令；不得发送 `deleteImages`、`exportImages`、`importImages`、`updateImageNote`。
- 保护区：已安装 XPI、用户 Zotero profile、`zotero.sqlite*`、外部 SQLite、PPT 仓库。
- 闸门：`npm.cmd run check` = 单元／静态检查 + PPT 侧 `validate-zotero-image-library.mjs` + 无头 Chromium UI 审计。

## 已关闭事项

- 在线更新检查与 GitHub Actions 发布工作流保持移除；`updates.json` 为空 feed。
