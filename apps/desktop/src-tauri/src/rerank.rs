use std::path::{Path, PathBuf};
use std::sync::Mutex;

use anyhow::{anyhow, Context};
use ndarray::Array2;
use ort::{
    session::{builder::GraphOptimizationLevel, Session},
    value::Value,
};
use tokenizers::Tokenizer;

const MAX_LEN: usize = 512;

pub struct Reranker {
    session: Mutex<Session>,
    tokenizer: Tokenizer,
}

impl Reranker {
    pub fn load(resource_dir: &Path) -> anyhow::Result<Self> {
        let model_path: PathBuf = resource_dir.join("bge-reranker-base.onnx");
        let tokenizer_path: PathBuf = resource_dir.join("tokenizers").join("bge-reranker.json");

        let session = Session::builder()?
            .with_optimization_level(GraphOptimizationLevel::Level3)?
            .with_intra_threads(2)?
            .commit_from_file(&model_path)
            .with_context(|| format!("load reranker model {}", model_path.display()))?;

        let tokenizer = Tokenizer::from_file(&tokenizer_path)
            .map_err(|e| anyhow!("load reranker tokenizer: {e}"))?;

        Ok(Self {
            session: Mutex::new(session),
            tokenizer,
        })
    }

    /// Score (query, candidate) pairs. Higher = more relevant.
    pub fn score(&self, query: &str, candidates: &[String]) -> anyhow::Result<Vec<f32>> {
        if candidates.is_empty() {
            return Ok(vec![]);
        }

        let pairs: Vec<(String, String)> = candidates
            .iter()
            .map(|c| (query.to_string(), c.clone()))
            .collect();

        let encodings = self
            .tokenizer
            .encode_batch(pairs, true)
            .map_err(|e| anyhow!("tokenize reranker pairs: {e}"))?;

        let batch = encodings.len();
        let max_len = encodings
            .iter()
            .map(|e| e.get_ids().len().min(MAX_LEN))
            .max()
            .unwrap_or(0);

        let mut input_ids = Array2::<i64>::zeros((batch, max_len));
        let mut attn_mask = Array2::<i64>::zeros((batch, max_len));

        for (i, enc) in encodings.iter().enumerate() {
            let ids = enc.get_ids();
            let mask = enc.get_attention_mask();
            let n = ids.len().min(max_len);
            for j in 0..n {
                input_ids[[i, j]] = ids[j] as i64;
                attn_mask[[i, j]] = mask[j] as i64;
            }
        }

        let mut sess = self.session.lock().unwrap();
        let outputs = sess.run(ort::inputs![
            "input_ids" => Value::from_array(input_ids)?,
            "attention_mask" => Value::from_array(attn_mask)?,
        ]?)?;

        let (shape, data) = outputs[0].try_extract_tensor::<f32>()?;
        // shape: [batch, 1] for bge-reranker-base
        let last = shape[shape.len() - 1] as usize;
        let mut scores = Vec::with_capacity(batch);
        for b in 0..batch {
            scores.push(data[b * last]);
        }
        Ok(scores)
    }
}
