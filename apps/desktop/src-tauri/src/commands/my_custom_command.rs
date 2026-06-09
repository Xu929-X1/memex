//this file contains all tauri commands
use crate::uia::print_element;
use uiautomation::{Result, UIAutomation};
#[tauri::command]
pub fn my_custom_command() -> std::result::Result<(), String> {
    // UIAutomation::new() initializes COM as MTA. The Tauri main thread is
    // already COM-initialized as STA for the webview, so calling it there
    // fails with RPC_E_CHANGED_MODE. Run it on a dedicated thread that has
    // no prior COM init.
    std::thread::spawn(|| -> Result<()> {
        let automation = UIAutomation::new()?;
        let walker = automation.get_control_view_walker()?;
        let root = automation.get_focused_element()?;

        print_element(&walker, &root, 0)?;

        Ok(())
    })
    .join()
    .map_err(|_| "uiautomation thread panicked".to_string())?
    .map_err(|e| e.to_string())
}
