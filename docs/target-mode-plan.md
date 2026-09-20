# 目标模式计划

> 仅保留当前状态快照，不作为后台自动执行计划。修改受 `PROJECT_CONSTRAINTS.md` 约束。按约定压缩重写，不追加批次流水。

## 当前状态

- 版本 `0.1.158`；插件 ID `pdf-image-saver@zlk.local`。
- `0.1.158`：手动选区支持多次涂加、细擦、笔径调节；按涂刷蒙版轮廓生成单色 SVG，封闭内孔填主色；整图仍采用原描摹。
- 冻结合同：SQLite schema 3；`GLOBAL_LIBRARY_VIEW_VERSION = "48"`。
- 闸门：`npm.cmd run check`。

## 已关闭事项

- 在线更新检查与 GitHub Actions 保持移除；`updates.json` 为空 feed。
