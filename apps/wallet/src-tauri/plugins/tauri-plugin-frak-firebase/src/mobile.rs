use tauri::{
    plugin::{PluginApi, PluginHandle},
    AppHandle, Runtime,
};

use crate::models::{CreateChannelArgs, FcmToken, PermissionStatus, SendNotificationArgs};

#[cfg(target_os = "android")]
const PLUGIN_IDENTIFIER: &str = "com.plugin.frak_firebase";

#[cfg(target_os = "ios")]
tauri::ios_plugin_binding!(init_plugin_frak_firebase);

/// Rust-side handle to the native FCM bridge. Crashlytics commands are
/// invoked from JS straight into the native side (no Rust hop required),
/// so this struct only exposes the FCM commands that have Rust handlers.
pub struct FrakFirebase<R: Runtime>(PluginHandle<R>);

impl<R: Runtime> FrakFirebase<R> {
    pub fn get_token(&self) -> crate::Result<FcmToken> {
        self.0.run_mobile_plugin("getToken", ()).map_err(Into::into)
    }

    pub fn request_permissions(&self) -> crate::Result<PermissionStatus> {
        self.0
            .run_mobile_plugin("requestPermissions", ())
            .map_err(Into::into)
    }

    pub fn check_permissions(&self) -> crate::Result<PermissionStatus> {
        self.0
            .run_mobile_plugin("checkPermissions", ())
            .map_err(Into::into)
    }

    pub fn register(&self) -> crate::Result<()> {
        self.0.run_mobile_plugin("register", ()).map_err(Into::into)
    }

    pub fn delete_token(&self) -> crate::Result<()> {
        self.0
            .run_mobile_plugin("deleteToken", ())
            .map_err(Into::into)
    }

    pub fn create_channel(&self, args: CreateChannelArgs) -> crate::Result<()> {
        self.0
            .run_mobile_plugin("createChannel", args)
            .map_err(Into::into)
    }

    pub fn send_notification(&self, args: SendNotificationArgs) -> crate::Result<()> {
        self.0
            .run_mobile_plugin("sendNotification", args)
            .map_err(Into::into)
    }
}

pub fn init<R: Runtime>(
    _app: &AppHandle<R>,
    api: PluginApi<R, ()>,
) -> std::result::Result<FrakFirebase<R>, Box<dyn std::error::Error>> {
    #[cfg(target_os = "android")]
    let handle = api.register_android_plugin(PLUGIN_IDENTIFIER, "FrakFirebasePlugin")?;
    #[cfg(target_os = "ios")]
    let handle = api.register_ios_plugin(init_plugin_frak_firebase)?;

    Ok(FrakFirebase(handle))
}
