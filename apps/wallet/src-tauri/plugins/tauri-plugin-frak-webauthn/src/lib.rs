use tauri::{
    plugin::{Builder, TauriPlugin},
    Runtime,
};

#[cfg(mobile)]
mod mobile;

pub fn init<R: Runtime>() -> TauriPlugin<R> {
    Builder::new("frak-webauthn")
        .setup(|_app, _api| {
            #[cfg(mobile)]
            mobile::init(_app, _api)?;
            Ok(())
        })
        .build()
}
