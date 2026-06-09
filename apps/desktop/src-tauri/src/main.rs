#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
mod uia;

fn main() {
    memex_desktop_lib::run();
}
