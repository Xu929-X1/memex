use crate::db::{models::UserInfo, queries};
use crate::state::AppState;
use keyring::Entry;
use tauri::State;
#[tauri::command]
pub fn save_auth(state: State<'_, AppState>, token: String, user: UserInfo) -> Result<(), String> {
    let mut conn = state.db.lock();
    queries::save_user(&mut conn, &user).map_err(|e| e.to_string())?;
    let entry = Entry::new("memex", &user.id).map_err(|e| e.to_string())?;
    entry.set_password(&token).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn get_token(state: State<'_, AppState>) -> Result<String, String> {
    let mut conn = state.db.lock();
    let user = queries::get_user(&mut conn)
        .map_err(|e| e.to_string())?
        .ok_or("No User Credential Found")?;
    let entry = Entry::new("memex", &user.id)
        .map_err(|e| e.to_string())
        .unwrap();
    entry.get_password().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_token(state: State<'_, AppState>) -> Result<(), String> {
    let mut conn = state.db.lock();
    let user = queries::get_user(&mut conn)
        .map_err(|e| e.to_string())?
        .ok_or("No User Credential Found")
        .unwrap();
    let entry = Entry::new("memex", &user.id).map_err(|e| e.to_string())?;
    match entry.delete_credential() {
        Ok(()) => {}
        Err(e) => return Err(e.to_string()),
    }
    queries::clear_users(&mut conn).map_err(|e| e.to_string())?;
    Ok(())
}
