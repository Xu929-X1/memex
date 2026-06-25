// Global text-selection watcher. Runs on its own thread (COM MTA, like the
// other UIA code) and watches for left-mouse-button releases anywhere on the
// system. On release it reads the focused element's selected text via UIA and,
// if there's a non-empty new selection, positions + shows the `hud` window and
// emits the text to its webview.

use std::thread;
use std::time::Duration;

use tauri::{AppHandle, Emitter, LogicalPosition, Manager, Position};
use uiautomation::patterns::UITextPattern;
use uiautomation::UIAutomation;
use windows::Win32::Foundation::POINT;
use windows::Win32::UI::Input::KeyboardAndMouse::{GetAsyncKeyState, VK_LBUTTON};
use windows::Win32::UI::WindowsAndMessaging::GetCursorPos;

#[derive(Clone, serde::Serialize)]
struct SelectionPayload {
    text: String,
}

/// Spawn the background watcher. Call once from setup().
pub fn spawn(app: AppHandle) {
    thread::spawn(move || {
        // UIAutomation::new() initializes COM (MTA) on this thread. Must not run
        // on the Tauri main thread, which is STA for the webview.
        let automation = match UIAutomation::new() {
            Ok(a) => a,
            Err(e) => {
                eprintln!("selection_watcher: UIA init failed: {e}");
                return;
            }
        };

        let mut was_down = false;
        let mut last_text = String::new();

        loop {
            let is_down = left_button_down();
            // Falling edge: button was down last tick, now up = a click/drag ended.
            let released = was_down && !is_down;
            was_down = is_down;

            if released {
                let sel = read_selection(&automation);
                eprintln!("[hud] mouse released, selection = {sel:?}");
                match sel {
                    Some(text) if !text.trim().is_empty() && text != last_text => {
                        last_text = text.clone();
                        eprintln!("[hud] showing panel for: {text:?}");
                        show_hud(&app, &text);
                    }
                    _ => hide_hud(&app),
                }
            }

            thread::sleep(Duration::from_millis(50));
        }
    });
}

fn left_button_down() -> bool {
    // High-order bit set = key currently down.
    unsafe { (GetAsyncKeyState(VK_LBUTTON.0 as i32) as u16 & 0x8000) != 0 }
}

fn cursor_pos() -> Option<(f64, f64)> {
    let mut pt = POINT::default();
    unsafe { GetCursorPos(&mut pt).ok()? };
    Some((pt.x as f64, pt.y as f64))
}

fn read_selection(automation: &UIAutomation) -> Option<String> {
    let focused = automation.get_focused_element().ok()?;
    let text_pattern: UITextPattern = focused.get_pattern().ok()?;
    let ranges = text_pattern.get_selection().ok()?;
    let mut out = String::new();
    for range in ranges {
        if let Ok(t) = range.get_text(-1) {
            out.push_str(&t);
        }
    }
    Some(out)
}

fn show_hud(app: &AppHandle, text: &str) {
    let Some(hud) = app.get_webview_window("hud") else { return };
    if let Some((x, y)) = cursor_pos() {
        // Offset so the panel sits just below-right of the cursor.
        let _ = hud.set_position(Position::Logical(LogicalPosition { x: x + 16.0, y: y + 16.0 }));
    }
    let _ = hud.emit("selection", SelectionPayload { text: text.to_string() });
    let _ = hud.show();
}

fn hide_hud(app: &AppHandle) {
    if let Some(hud) = app.get_webview_window("hud") {
        let _ = hud.hide();
    }
}
