use tauri::{
    plugin::{Builder, TauriPlugin},
    Runtime,
};

#[cfg(mobile)]
mod mobile;

pub fn init<R: Runtime>() -> TauriPlugin<R> {
    Builder::new("install-referrer")
        .setup(|app, api| {
            #[cfg(mobile)]
            mobile::init(app, api)?;
            Ok(())
        })
        .build()
}
