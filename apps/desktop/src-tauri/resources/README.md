# Bundled ONNX models

The desktop binary needs two ONNX models + their tokenizers at runtime. These
are not checked in (see `apps/desktop/.gitignore`). Download once before the
first `cargo run` / `npm run tauri:dev`.

```
resources/
  bge-small-en-v1.5.onnx           # ~33 MB, embedder
  bge-reranker-base.onnx           # ~95 MB, cross-encoder reranker
  tokenizers/
    bge-small.json                 # tokenizer for the embedder
    bge-reranker.json              # tokenizer for the reranker
```

## How to fetch

```powershell
# from apps/desktop/src-tauri/resources
huggingface-cli download Xenova/bge-small-en-v1.5 onnx/model.onnx --local-dir .
mv onnx/model.onnx bge-small-en-v1.5.onnx

huggingface-cli download Xenova/bge-reranker-base onnx/model.onnx --local-dir .
mv onnx/model.onnx bge-reranker-base.onnx

mkdir tokenizers
huggingface-cli download BAAI/bge-small-en-v1.5 tokenizer.json --local-dir tokenizers
mv tokenizers/tokenizer.json tokenizers/bge-small.json

huggingface-cli download BAAI/bge-reranker-base tokenizer.json --local-dir tokenizers
mv tokenizers/tokenizer.json tokenizers/bge-reranker.json
```

Alternative ONNX exports work as long as I/O signatures match:
- Embedder: `input_ids`, `attention_mask`, `token_type_ids` → `[batch, seq, 384]`
- Reranker: `input_ids`, `attention_mask` → `[batch, 1]` logits

After the files exist Tauri's `bundle.resources` glob picks them up on
`npm run tauri:build`.
