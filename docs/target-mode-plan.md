# 目标模式计划

> 仅保留当前状态快照，不作为后台自动执行计划。修改受 `PROJECT_CONSTRAINTS.md` 约束。按约定压缩重写，不追加批次流水。

## 当前状态

- 版本 `0.1.160`；插件 ID `pdf-image-saver@zlk.local`。
- `0.1.160`：手动选区可直接导出透明 PNG，保留原始像素、颜色与擦出的孔洞；近似 SVG 导出继续保留。
- 冻结合同：SQLite schema 3；`GLOBAL_LIBRARY_VIEW_VERSION = "50"`。
- 闸门：`npm.cmd run check`。

## 已关闭事项

- 在线更新检查与 GitHub Actions 保持移除；`updates.json` 为空 feed。
