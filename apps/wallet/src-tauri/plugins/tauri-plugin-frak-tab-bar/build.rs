// `register_listener` / `remove_listener` come from Tauri's base Swift `Plugin`;
// listing them is what grants JS `addPluginListener("frak-tab-bar", …)`.
const COMMANDS: &[&str] = &["is_supported", "update", "register_listener", "remove_listener"];

fn main() {
    tauri_plugin::Builder::new(COMMANDS).ios_path("ios").build();
}
