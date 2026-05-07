fn main() {
    tauri_build::try_build(tauri_build::Attributes::new().plugin(
        "app-settings",
        tauri_build::InlinedPlugin::new().commands(&["open_notification_settings"]),
    ))
    .expect("failed to run tauri-build");

    // Re-run when variant flips so entitlements stay in sync between dev/prod toggles.
    println!("cargo:rerun-if-env-changed=FRAK_VARIANT");

    #[cfg(target_os = "macos")]
    sync_ios_entitlements();
}

/// Rewrite `app_iOS.entitlements` to match the active variant (prod or dev).
///
/// Tauri's CLI exposes `TAURI_IOS_PROJECT_PATH` + `TAURI_IOS_APP_NAME` only during the
/// iOS build pipeline (xcode-script). Outside of that (regular `cargo check` /
/// desktop builds), the env vars are absent and this is a no-op.
///
/// Replaces the `tauri-mobile-release.yml` "Patch iOS shell for dev variant"
/// step plus `scripts/patch-ios-dev.sh` — both of which mutated `gen/apple/project.yml`
/// in place. project.yml is only consulted on `tauri ios init`, so patching it
/// for `tauri ios dev/build` was a no-op anyway. The entitlements file *is* read
/// by Xcode on every build, so rewriting that here is what actually flips the
/// associated domains for WebAuthn + universal links.
#[cfg(target_os = "macos")]
fn sync_ios_entitlements() {
    use std::path::PathBuf;

    let Some(project_path) = std::env::var_os("TAURI_IOS_PROJECT_PATH").map(PathBuf::from) else {
        return;
    };
    let Ok(app_name) = std::env::var("TAURI_IOS_APP_NAME") else {
        return;
    };

    let entitlements_path = project_path
        .join(format!("{app_name}_iOS"))
        .join(format!("{app_name}_iOS.entitlements"));

    if !entitlements_path.exists() {
        return;
    }

    let is_dev = std::env::var("FRAK_VARIANT").as_deref() == Ok("dev");
    let host = if is_dev { "wallet-dev.frak.id" } else { "wallet.frak.id" };
    let bundle_suffix = if is_dev { ".dev" } else { "" };

    let plist = match plist::Value::from_file(&entitlements_path) {
        Ok(v) => v,
        Err(e) => {
            println!("cargo:warning=failed to read {entitlements_path:?}: {e}");
            return;
        }
    };
    let mut dict = plist.into_dictionary().unwrap_or_default();

    dict.insert(
        "com.apple.developer.associated-domains".into(),
        plist::Value::Array(vec![
            plist::Value::String("webcredentials:frak.id".into()),
            plist::Value::String(format!("webcredentials:{host}")),
            plist::Value::String(format!("applinks:{host}")),
        ]),
    );
    dict.insert(
        "keychain-access-groups".into(),
        plist::Value::Array(vec![plist::Value::String(format!(
            "$(AppIdentifierPrefix)id.frak.wallet{bundle_suffix}"
        ))]),
    );

    // Serialize to a buffer so we can compare and avoid no-op writes (Xcode treats
    // mtime changes as a reason to re-sign even when contents match).
    let mut buf = Vec::new();
    if let Err(e) = plist::to_writer_xml(std::io::Cursor::new(&mut buf), &dict) {
        println!("cargo:warning=failed to serialize entitlements: {e}");
        return;
    }
    // POSIX trailing newline so the file stays byte-stable against git baseline.
    buf.push(b'\n');

    let needs_write = match std::fs::read(&entitlements_path) {
        Ok(existing) => existing != buf,
        Err(_) => true,
    };

    if needs_write {
        if let Err(e) = std::fs::write(&entitlements_path, &buf) {
            println!("cargo:warning=failed to write {entitlements_path:?}: {e}");
        } else {
            println!(
                "cargo:warning=entitlements synced for variant={} ({})",
                if is_dev { "dev" } else { "prod" },
                entitlements_path.display()
            );
        }
    }
}
