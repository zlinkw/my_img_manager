# 图片库分享与导入协议

## 固定格式

- 扩展名：`.pislib`
- `format`：`paper-image-library-share/v1`
- `schema_version`：`1`
- 内容：UTF-8 JSON；运行环境支持时使用 gzip，导入按 gzip 文件头自动识别
- 上限：1000 张、原图合计 512 MB、包文件 720 MB、单图 25 MB

分享包只包含原始图片字节和可独立使用的图片元数据。禁止包含 PDF 文件、Zotero 文献附件、`parent_item_key`、`pdf_attachment_key`、`library_id`、`group_id` 或本机 `zotero://` URI。

每张图片必须包含 `content_sha256`、`mime_type`、`image_base64`、论文标题、年份、DOI、页码和采集时间。类别、色系、样式标签、清晰度、识别方式、尺寸、边界框、调色板、主色和对比色存在时必须原样分享。

## 导入规则

1. 校验格式、大小、图片类型和 SHA-256；重复或损坏记录跳过。
2. 按 `content_sha256` 去重，不覆盖已有图片内容。
3. 优先用规范化 DOI 匹配本机 Zotero 条目。
4. DOI 未匹配时，仅接受唯一的规范化标题与年份匹配。
5. 匹配后写入本机条目和 PDF 定位信息；只有条目而没有 PDF 时只允许定位文献。
6. 未匹配时保留论文名称、DOI、年份、页码和全部图片元数据，所有自动跳转字段留空。
7. 导入只写固定外部 SQLite，不读取或修改 Zotero 内部 `zotero.sqlite*`。

## 管理命令

生成的本地图库仅通过受 token 保护的固定 endpoint 调用 `exportImages`、`importImages` 和 `deleteImages`。导入和分享路径必须由 Zotero 原生文件选择器取得。删除为共享库软删除，不删除 Zotero 文献或 PDF。PPT 插件不得发送这些图库管理命令。
