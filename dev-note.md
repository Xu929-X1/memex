# Known Limitation

## Ingestion Pipeline:
- 中文 PDF 排版提取有乱码（全角字符、私用区字符）
- Chunk 切割偏细，LLM extraction 串行导致速度慢
- Heading context 在并行模式下连续性丢失

- 接 Unstructured API（自部署 Docker）替换 parser 层
- Ingestion LLM calls 改为并行，牺牲 heading context 连续性
- 长期考虑 Azure Document Intelligence 处理复杂中文 PDF