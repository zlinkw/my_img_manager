# 目标模式计划

> 仅保留当前状态快照，不作为后台自动执行计划。修改受 `PROJECT_CONSTRAINTS.md` 约束。按约定压缩重写，不追加批次流水。

## 当前状态

- 版本 `0.1.139`；插件 ID `pdf-image-saver@zlk.local`；`strict_max_version: 11.*`；`update_url` 指向仓库静态空 feed。
- `0.1.135` 放宽兼容上限到 `11.*`：Zotero 10.0.2 下旧上限使插件被置为 `appDisabled`。
- `0.1.136` 补上 `applications.zotero.update_url`：Zotero 10 缺该字段即报 `Extension is invalid`，从文件安装失败。`updates.json` 保持空 feed，永不下载更新。
- `0.1.139` 新增自定义描述 `user_note`（schema 3）：采集窗口可填、图库卡片可就地编辑并写回、表格新增“描述”列、随分享包往返；查看器关闭控件改为 `×` 并声明返回列表。
- `0.1.139` 修复生成页脚本整体失效：脚本外层是模板字符串，正则里的 `\n` 被当转义序列吃掉导致语法错误，图库交互全部静默失效。测试现在逐个解析生成页 `<script>` 拦截。
- 交付包由 `scripts/build.ps1` 生成并校验；开发用带时间戳 recovery 包，公开发布用 `pdf-image-saver-<version>.xpi`。
- 冻结合同：SQLite schema 3；locator schema 1；producer `zotero-pdf-image-saver`；`GLOBAL_LIBRARY_VIEW_VERSION = "38"`；bridge `POST http://127.0.0.1:23119/pdf-image-saver/bridge`。
- PPT 仅可调用 `refreshLibrary` 与冻结的来源定位命令；不得发送 `deleteImages`、`exportImages`、`importImages`、`updateImageNote`。
- 保护区：已安装 XPI、用户 Zotero profile、`zotero.sqlite*`、外部 SQLite、PPT 仓库。
- 闸门：`npm.cmd run check` = 单元／静态检查 + PPT 侧 `validate-zotero-image-library.mjs` + 无头 Chromium UI 审计；后两者在缺少 PPT 仓库或浏览器时显式跳过而非失败。UI 审计额外断言审计期间不产生新的浏览器 page target。

## 已关闭事项

- 历史交付链、UI 审计夹具、错误翻译、设置页修复提示、页码措辞、分享白名单和离线发布边界均已关闭。`0.1.131` 已补齐阅读器菜单键盘操作和图库加载失败提示。
- 插件自身的在线更新检查模块与 GitHub Actions 发布工作流保持移除；`updates.json` 仅作为 Zotero 10 强制要求的空 feed 存在，不承载任何可下载更新。

## 当前目标

- 待用户确认：完整图库页“查看大图”被报告会新建浏览器标签页。源码、全部已发布 XPI、git 历史和无头审计均无 `window.open`／`target="_blank"`，审计也确认点击不产生新 page target；需用户提供新标签页地址后继续。

## 已完成批次（2026-08-24）

- 批次 `failure-feedback-prefs-0.1.132`：设置页 Python 选择器不可用时给出中文手动路径指引；统一高级设置默认值；图库在监听器建立前已失败的原图也会进入失败态，失败期间禁用下载原图并在成功后恢复。范围仅限偏好页、完整图库反馈、测试审计与发版号。
- 验收：`npm.cmd test`、`git diff --check`、`npm.cmd run check`、`npm.cmd run build`；通过后提交并推送 `origin/master`，再按用户既有约定在 Zotero 关闭时安装当前 XPI。
- 复查：无头 Chromium UI 审计通过，并抽查当前论文索引、图库、表格、高清查看器、移动图库、离线管理态、偏好页和确认对话框截图；未发现可安全继续处理的明确 UI 或功能逻辑改进点。
- 批次 `profile-install-compat-0.1.133`：修正 Zotero 安装范围并同步约束、README、检查和测试。
- 批次 `silent-profile-install-0.1.134`：新增 XPI 注册辅助脚本并接入 `install:xpi`；修复移动宽度下图库按钮越界。
- 验收：`npm.cmd test`、`git diff --check`、`npm.cmd run check`、`npm.cmd run build`。
