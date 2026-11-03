use std::{io, path::Path};

use tauri::{
    plugin::{Builder, TauriPlugin},
    Manager, Runtime,
};

/// File names owned by `tauri-plugin-ota-updater` 2.1.0 in `app_cache_dir`.
const OTA_FILES: [&str; 3] = [
    "latest-update.tar.gz",
    "ota-updates-manifest.json",
    "ota-updates-manifest.meta.json",
];
const MARKER: &str = "ota-binary-version";

/// Deletes the cached OTA bundle when it was downloaded by another binary version.
///
/// The plugin only compares the bundle's publish date with the build date, so a
/// hotfix published for N while N+1 was in review would boot on N+1.
pub fn reset_if_binary_changed(cache_dir: &Path, version: &str) -> io::Result<bool> {
    let marker = cache_dir.join(MARKER);
    if std::fs::read_to_string(&marker).ok().as_deref() == Some(version) {
        return Ok(false);
    }
    for name in OTA_FILES {
        match std::fs::remove_file(cache_dir.join(name)) {
            Err(e) if e.kind() != io::ErrorKind::NotFound => return Err(e),
            _ => {}
        }
    }
    std::fs::create_dir_all(cache_dir)?;
    std::fs::write(marker, version)?;
    Ok(true)
}

/// Must be registered before the OTA plugin: its setup loads the cached manifest.
pub fn init<R: Runtime>() -> TauriPlugin<R> {
    Builder::new("ota-cache-guard")
        .setup(|app, _| {
            let version = app.package_info().version.to_string();
            match app.path().app_cache_dir() {
                // A failed reset keeps the plugin's own behaviour; never block launch on it.
                Ok(dir) => match reset_if_binary_changed(&dir, &version) {
                    Ok(true) => log::info!("OTA cache reset for binary {version}"),
                    Ok(false) => {}
                    Err(e) => log::error!("OTA cache reset failed: {e}"),
                },
                Err(e) => log::error!("OTA cache dir unavailable: {e}"),
            }
            Ok(())
        })
        .build()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_cache(name: &str) -> std::path::PathBuf {
        let dir = std::env::temp_dir().join(format!("ota-cache-{name}-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();
        dir
    }

    fn seed(dir: &Path) {
        for name in OTA_FILES {
            std::fs::write(dir.join(name), b"x").unwrap();
        }
    }

    #[test]
    fn first_launch_clears_and_marks() {
        let dir = temp_cache("first");
        seed(&dir);
        assert!(reset_if_binary_changed(&dir, "1.1.7").unwrap());
        assert!(OTA_FILES.iter().all(|f| !dir.join(f).exists()));
        assert_eq!(std::fs::read_to_string(dir.join(MARKER)).unwrap(), "1.1.7");
    }

    #[test]
    fn same_version_keeps_the_bundle() {
        let dir = temp_cache("same");
        reset_if_binary_changed(&dir, "1.1.7").unwrap();
        seed(&dir);
        assert!(!reset_if_binary_changed(&dir, "1.1.7").unwrap());
        assert!(OTA_FILES.iter().all(|f| dir.join(f).exists()));
    }

    #[test]
    fn new_binary_drops_the_previous_bundle() {
        let dir = temp_cache("upgrade");
        reset_if_binary_changed(&dir, "1.1.6").unwrap();
        seed(&dir);
        assert!(reset_if_binary_changed(&dir, "1.1.7").unwrap());
        assert!(OTA_FILES.iter().all(|f| !dir.join(f).exists()));
    }

    #[test]
    fn creates_a_missing_cache_dir() {
        let dir = temp_cache("missing").join("nested");
        assert!(reset_if_binary_changed(&dir, "1.1.7").unwrap());
        assert!(dir.join(MARKER).exists());
    }
}
