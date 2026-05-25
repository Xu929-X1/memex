use std::path::{Path, PathBuf};
use std::sync::Mutex;

use anyhow::{anyhow, Context};
use ndarray::{Array2, Axis};
use ort::{
    session::{builder::GraphOptimizationLevel, Session},
    value::Value,
};
use tokenizers::Tokenizer;

pub const EMBED_DIM: usize = 384;
const MAX_LEN: usize = 512;

pub struct Embedder {
    session: Mutex<Session>,
    tokenizer: Tokenizer,
}

impl Embedder {
    pub fn load(resource_dir: &Path) -> anyhow::Result<Self> {
        let model_path: PathBuf = resource_dir.join("bge-small-en-v1.5.onnx");
        let tokenizer_path: PathBuf = resource_dir.join("tokenizers").join("bge-small.json");

        let session = Session::builder()?
            .with_optimization_level(GraphOptimizationLevel::Level3)?
            .with_intra_threads(2)?
            .commit_from_file(&model_path)
            .with_context(|| format!("load embedder model {}", model_path.display()))?;

        let tokenizer = Tokenizer::from_file(&tokenizer_path)
            .map_err(|e| anyhow!("load embedder tokenizer: {e}"))?;

        Ok(Self {
            session: Mutex::new(session),
            tokenizer,
        })
    }

    /// Mean-pooled, L2-normalized embedding for a single string. 384d.
    pub fn embed_one(&self, text: &str) -> anyhow::Result<Vec<f32>> {
        self.embed_batch(&[text.to_string()])
            .map(|mut v| v.pop().unwrap_or_default())
    }

    pub fn embed_batch(&self, texts: &[String]) -> anyhow::Result<Vec<Vec<f32>>> {
        if texts.is_empty() {
            return Ok(vec![]);
        }

        let encodings = self
            .tokenizer
            .encode_batch(texts.iter().map(|s| s.as_str()).collect::<Vec<_>>(), true)
            .map_err(|e| anyhow!("tokenize batch: {e}"))?;

        let batch = encodings.len();
        let max_len = encodings
            .iter()
            .map(|e| e.get_ids().len().min(MAX_LEN))
            .max()
            .unwrap_or(0);

        let mut input_ids = Array2::<i64>::zeros((batch, max_len));
        let mut attn_mask = Array2::<i64>::zeros((batch, max_len));
        let mut token_type = Array2::<i64>::zeros((batch, max_len));

        for (i, enc) in encodings.iter().enumerate() {
            let ids = enc.get_ids();
            let mask = enc.get_attention_mask();
            let toks = enc.get_type_ids();
            let n = ids.len().min(max_len);
            for j in 0..n {
                input_ids[[i, j]] = ids[j] as i64;
                attn_mask[[i, j]] = mask[j] as i64;
                token_type[[i, j]] = toks[j] as i64;
            }
        }

        let mut sess = self.session.lock().unwrap();
        let outputs = sess.run(ort::inputs![
            "input_ids" => Value::from_array(input_ids.clone())?,
            "attention_mask" => Value::from_array(attn_mask.clone())?,
            "token_type_ids" => Value::from_array(token_type)?,
        ]?)?;

        let (shape, data) = outputs[0].try_extract_tensor::<f32>()?;
        // shape: [batch, seq, hidden]
        let seq = shape[1] as usize;
        let hidden = shape[2] as usize;
        if hidden != EMBED_DIM {
            return Err(anyhow!("unexpected hidden dim {hidden} != {EMBED_DIM}"));
        }

        let mut out = Vec::with_capacity(batch);
        for b in 0..batch {
            let mut pooled = vec![0f32; hidden];
            let mut denom = 0f32;
            for s in 0..seq {
                let m = attn_mask[[b, s]] as f32;
                if m == 0.0 {
                    continue;
                }
                denom += m;
                let off = (b * seq + s) * hidden;
                for h in 0..hidden {
                    pooled[h] += data[off + h] * m;
                }
            }
            if denom > 0.0 {
                for h in 0..hidden {
                    pooled[h] /= denom;
                }
            }
            // L2 normalize
            let norm = pooled.iter().map(|x| x * x).sum::<f32>().sqrt().max(1e-12);
            for h in 0..hidden {
                pooled[h] /= norm;
            }
            out.push(pooled);
        }

        drop(sess);
        let _ = Axis(0); // keep ndarray Axis usage explicit for future pooling alternatives
        Ok(out)
    }
}
