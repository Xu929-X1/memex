mod commands;
mod db;
mod state;
pub mod uia;

use state::AppState;
use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    LogicalPosition, Manager, Position, WindowEvent,
};
use tauri_plugin_window_state::{AppHandleExt, StateFlags};

fn show_main_window(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            commands::auth_commands::save_auth,
            commands::auth_commands::get_token,
            commands::auth_commands::delete_token,
        ])
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_http::init())
        .plugin(
            tauri_plugin_window_state::Builder::default()
                // We control first paint manually; don't let the plugin
                // restore visibility and show the window before it's placed.
                .with_state_flags(StateFlags::all() & !StateFlags::VISIBLE)
                .build(),
        )
        .setup(|app| {
            // System tray: keeps the app reachable while it runs in the background.
            let show_item = MenuItem::with_id(app, "show", "Show memex", true, None::<&str>)?;
            let sep = PredefinedMenuItem::separator(app)?;
            let quit_item = MenuItem::with_id(app, "quit", "Quit memex", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show_item, &sep, &quit_item])?;
            let path = app
                .path()
                .app_data_dir()
                .expect("no app data dir")
                .join("memex.db");
            std::fs::create_dir_all(path.parent().unwrap())?;
            let db = db::Db::open(&path).map_err(|e| e.to_string())?;
            app.manage(AppState { db });
            let window = app.get_webview_window("main").unwrap();

            // First run only: no saved state yet, so seed a default position.
            // After the user moves + closes once, the window-state plugin
            // restores the remembered position and we leave it alone.
            let has_state = app
                .path()
                .app_config_dir()
                .map(|d| d.join(".window-state.json").exists())
                .unwrap_or(false);
            if !has_state {
                window.set_position(Position::Logical(LogicalPosition { x: 100.0, y: 100.0 }))?;
            }
            // Window starts hidden (visible:false) so it never paints at the
            // default spot before the restored position is applied. Reveal now.
            window.show()?;

            TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .tooltip("memex")
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "show" => show_main_window(app),
                    "quit" => app.exit(0),
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        show_main_window(tray.app_handle());
                    }
                })
                .build(app)?;

            Ok(())
        })
        .on_window_event(|window, event| match event {
            // Closing the window hides it to tray instead of quitting the app.
            WindowEvent::CloseRequested { api, .. } => {
                let _ = window.app_handle().save_window_state(StateFlags::all());
                let _ = window.hide();
                api.prevent_close();
            }
            // Dev rebuilds hard-kill the process — CloseRequested never fires,
            // so persist on every move/resize to keep the state file current.
            WindowEvent::Moved(_) | WindowEvent::Resized(_) => {
                let _ = window.app_handle().save_window_state(StateFlags::all());
            }
            _ => {}
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
