use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};

const CONFIG_FILE: &str = "config.json";

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct Config {
    /// e.g. "https://memex.example.com"
    pub base_url: String,
    /// JWT auth_token captured via login webview.
    pub auth_token: Option<String>,
    /// ISO-8601 cursor for incremental sync.
    pub last_sync_cursor: Option<String>,
}

fn path() -> PathBuf {
    dirs::data_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("memex")
        .join(CONFIG_FILE)
}

pub fn load(app_dir: &Path) -> anyhow::Result<Config> {
    let p = app_dir.join(CONFIG_FILE);
    if !p.exists() {
        return Ok(Config::default());
    }
    let s = std::fs::read_to_string(&p)?;
    Ok(serde_json::from_str(&s)?)
}

pub fn save(cfg: &Config) -> anyhow::Result<()> {
    let p = path();
    if let Some(parent) = p.parent() {
        std::fs::create_dir_all(parent)?;
    }
    let s = serde_json::to_string_pretty(cfg)?;
    std::fs::write(p, s)?;
    Ok(())
}
