# 目标模式计划

> 仅保留当前状态快照，不作为后台自动执行计划。修改受 `PROJECT_CONSTRAINTS.md` 约束。按约定压缩重写，不追加批次流水。

## 当前状态

- 版本 `0.1.154`；插件 ID `pdf-image-saver@zlk.local`。
- `0.1.154`：近似 SVG 优先精细描摹，超过文件上限时回退紧凑参数，保留小标记并控制体积。
- 冻结合同：SQLite schema 3；`GLOBAL_LIBRARY_VIEW_VERSION = "46"`。
- 闸门：`npm.cmd run check`。

## 已关闭事项

- 在线更新检查与 GitHub Actions 保持移除；`updates.json` 为空 feed。
