use crate::db::{models::UserInfo, queries};
use crate::state::AppState;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::State;

#[tauri::command]
pub fn save_auth(state: State<'_, AppState>, token: String, user: UserInfo) -> Result<(), String> {
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|e| e.to_string())?
        .as_secs() as i64;
    let mut conn = state.db.lock();
    queries::save_session(&mut conn, &token, now).map_err(|e| e.to_string())?;
    queries::save_user(&mut conn, &user).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn get_token(state: State<'_, AppState>) -> Result<Option<String>, String> {
    let mut conn = state.db.lock();
    queries::get_token(&mut conn).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_token(state: State<'_, AppState>) -> Result<(), String> {
    let mut conn = state.db.lock();
    queries::clear_session(&mut conn).map_err(|e| e.to_string())?;
    queries::clear_users(&mut conn).map_err(|e| e.to_string())?;
    Ok(())
}
