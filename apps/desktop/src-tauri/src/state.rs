use crate::db::Db;

// Shared app state. Grows to hold embedder, local llm, queue, etc.
pub struct AppState {
    pub db: Db,
}
