mod config;
mod embed;
mod rerank;
mod store;
mod sync;

use std::sync::Arc;

use tauri::Manager;
use tokio::sync::Mutex;
use tracing_subscriber::EnvFilter;

pub struct AppState {
    pub store: Arc<Mutex<store::Store>>,
    pub embedder: Arc<embed::Embedder>,
    pub reranker: Arc<rerank::Reranker>,
    pub http: reqwest::Client,
    pub cfg: Arc<Mutex<config::Config>>,
}

#[tauri::command]
async fn sync_now(state: tauri::State<'_, AppState>) -> Result<sync::SyncStats, String> {
    let cfg = state.cfg.lock().await.clone();
    sync::run_sync(&state.http, &cfg, state.store.clone())
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn set_auth(
    state: tauri::State<'_, AppState>,
    base_url: String,
    auth_token: String,
) -> Result<(), String> {
    let mut cfg = state.cfg.lock().await;
    cfg.base_url = base_url;
    cfg.auth_token = Some(auth_token);
    config::save(&cfg).map_err(|e| e.to_string())
}

#[tauri::command]
async fn pending_count(state: tauri::State<'_, AppState>) -> Result<i64, String> {
    let store = state.store.lock().await;
    store.count().map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tracing_subscriber::fmt()
        .with_env_filter(EnvFilter::try_from_default_env().unwrap_or_else(|_| "info".into()))
        .init();

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            let app_dir = app
                .path()
                .app_data_dir()
                .expect("resolve app_data_dir");
            std::fs::create_dir_all(&app_dir).ok();

            let cfg = config::load(&app_dir).unwrap_or_default();
            let store = store::Store::open(&app_dir.join("memex.db"))
                .expect("open local store");

            // Models live next to the binary in the bundled resources dir.
            let resource_dir = app
                .path()
                .resource_dir()
                .expect("resolve resource_dir");
            let embedder = embed::Embedder::load(&resource_dir).expect("load embedder");
            let reranker = rerank::Reranker::load(&resource_dir).expect("load reranker");

            let http = reqwest::Client::builder()
                .cookie_store(true)
                .user_agent("memex-desktop/0.1")
                .build()
                .expect("build http client");

            app.manage(AppState {
                store: Arc::new(Mutex::new(store)),
                embedder: Arc::new(embedder),
                reranker: Arc::new(reranker),
                http,
                cfg: Arc::new(Mutex::new(cfg)),
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![sync_now, set_auth, pending_count])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
