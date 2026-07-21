# 目标模式计划

> 当前恢复批次的持久事实源。修改受 `PROJECT_CONSTRAINTS.md` 约束。

## 当前目标

恢复误删前的最新版 Zotero PDF 图片插件，保护已安装 `0.1.127` XPI，不覆盖安装，仅构建独立 `0.1.128` 候选并逐条对比。

## 范围

- 恢复源码、测试、构建脚本、图库协议和 PPT 复用合同。
- 常规采集仅保留框选；整页预览和高级原图提取保留为明确次级入口。
- 图片仅持久化到 `%LOCALAPPDATA%\ZLK\paper-image-library\paper_images.sqlite` 的 `image_blob`。
- 图库临时页面固定为 `%TEMP%\pdf-image-saver\paper-image-library-view\paper-image-library.html`。
- PPT 完整图库必须复用该页面，不维护第二套完整图库。

## 排除范围

- 不覆盖、安装、移动或修改现有 `pdf-image-saver@zlk.local.xpi`。
- 不读取或修改 `zotero.sqlite*`。
- 不恢复自动识别采集、Zotero HTML 预览附件、缩略图库或第二份数据库。
- 不修改 PPT 仓库。

## 冻结合同

- 插件 ID：`pdf-image-saver@zlk.local`。
- 目标 Zotero：9.x，`strict_max_version: 9.*`。
- SQLite schema：2；locator schema：1；producer：`zotero-pdf-image-saver`。
- `GLOBAL_LIBRARY_VIEW_VERSION = "37"`。
- Bridge：`POST http://127.0.0.1:23119/pdf-image-saver/bridge`。
- PPT 仅可调用 `refreshLibrary` 和已冻结的来源定位命令；不得发送 `deleteImages`、`exportImages`、`importImages`。

## 当前批次 B101

- 状态：已通过源码、打包和安装包对比验证。
- 问题：恢复源码与安装 XPI 的 10 个生产文件逐字节一致，但测试、构建、版本元数据和约束文档回退。
- 修复：同步 `package.json`，清理过时自动采集测试，恢复版本化非覆盖打包，重写当前约束。
- 保护区：已安装 XPI、用户 Zotero profile、外部 SQLite、PPT 仓库。
- 验证：`npm.cmd test`、`npm.cmd run check`、`npm.cmd run build`、XPI payload、逐条 archive 对比均通过。旧浏览器审计脚本仍含历史预览索引断言，未作为新版通过证据。
- 对比：新版只修改 `manifest.json`、`README.md` 和两条成功提示；其余 7 个生产条目与原安装包逐字节一致。
- 提交：待提交；仓库无 `origin`，无法执行规定的 `origin/master` 推送。

## 已知证据

- 参考 XPI：144836 字节，SHA256 `3ECF0B1F0CCC172D09DDA2C8C94E2E317D7FC5DDE72A7C09BA7874BA754D66F3`。
- 当前 10 个生产文件与参考 XPI 逐字节一致。
- 历史提交证据：`0d8ae45`、`e1b43fd`、`346f893`、`3212090`、`5f9ba28`。
- 参考 XPI 是删除前发布包证据；未打包脚本和测试必须以会话命令及当前合同重建后重新验证。
