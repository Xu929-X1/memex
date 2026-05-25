use std::sync::Arc;

use anyhow::{anyhow, Context};
use serde::{Deserialize, Serialize};
use tokio::sync::Mutex;

use crate::config::{self, Config};
use crate::store::{SectionRow, Store};

const PAGE_SIZE: usize = 500;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SyncItem {
    id: i64,
    document_id: String,
    content: String,
    kind: String,
    page_start: Option<i64>,
    page_end: Option<i64>,
    updated_at: String,
    sim_vector: Vec<f32>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SyncResponse {
    items: Vec<SyncItem>,
    next_cursor: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct SyncStats {
    pub pages: usize,
    pub rows: usize,
    pub last_cursor: Option<String>,
}

pub async fn run_sync(
    http: &reqwest::Client,
    cfg: &Config,
    store: Arc<Mutex<Store>>,
) -> anyhow::Result<SyncStats> {
    let base = cfg.base_url.trim_end_matches('/');
    if base.is_empty() {
        return Err(anyhow!("base_url not configured"));
    }
    let auth = cfg
        .auth_token
        .as_ref()
        .ok_or_else(|| anyhow!("auth_token not configured"))?;

    let mut cursor = cfg.last_sync_cursor.clone();
    let mut pages = 0usize;
    let mut rows = 0usize;

    loop {
        let mut url = format!("{base}/api/v1/sections/sync?limit={PAGE_SIZE}");
        if let Some(c) = cursor.as_ref() {
            url.push_str("&since=");
            url.push_str(&urlencoding(c));
        }

        let resp = http
            .get(&url)
            .header("cookie", format!("auth_token={auth}"))
            .send()
            .await
            .with_context(|| format!("GET {url}"))?;

        if !resp.status().is_success() {
            return Err(anyhow!(
                "sync {} -> {}: {}",
                url,
                resp.status(),
                resp.text().await.unwrap_or_default()
            ));
        }

        let body: serde_json::Value = resp.json().await.context("decode sync json")?;
        // withApiHandler wraps payload in { success, data, traceId } per the cloud convention.
        let data = body.get("data").cloned().unwrap_or(body);
        let page: SyncResponse =
            serde_json::from_value(data).context("decode SyncResponse from data")?;

        if page.items.is_empty() {
            break;
        }

        let batch: Vec<SectionRow> = page
            .items
            .iter()
            .map(|it| SectionRow {
                id: it.id,
                document_id: it.document_id.clone(),
                content: it.content.clone(),
                kind: it.kind.clone(),
                page_start: it.page_start,
                page_end: it.page_end,
                updated_at: it.updated_at.clone(),
                sim_vector: it.sim_vector.clone(),
            })
            .collect();

        {
            let mut s = store.lock().await;
            s.upsert_batch(&batch)?;
            if let Some(last) = page.items.last() {
                s.set_meta("last_sync_cursor", &last.updated_at)?;
            }
        }

        rows += page.items.len();
        pages += 1;
        cursor = page.next_cursor.clone();

        // Page returned less than full → done.
        if page.items.len() < PAGE_SIZE || page.next_cursor.is_none() {
            break;
        }
    }

    // Persist cursor to user config too.
    if let Some(c) = cursor.as_ref() {
        let mut updated = cfg.clone();
        updated.last_sync_cursor = Some(c.clone());
        config::save(&updated).ok();
    }

    Ok(SyncStats {
        pages,
        rows,
        last_cursor: cursor,
    })
}

fn urlencoding(s: &str) -> String {
    // Minimal — only chars that appear in ISO-8601 timestamps need handling.
    s.replace(':', "%3A").replace('+', "%2B")
}
