#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

/// Bridges Objective-C @try/@catch into Swift for the firebase plugin.
///
/// Identical contract to `tauri-plugin-recovery-hint`'s `ObjCExceptionCatcher`,
/// but namespaced with a `Frak` prefix so the two plugins can coexist in the
/// final app binary without an ObjC class-name collision.
///
/// `FirebaseApp.configure()` raises `NSException` (not a Swift `Error`) when
/// `GoogleService-Info.plist` is missing, malformed, bundle-id-mismatched, or
/// when called a second time. Swift's `do/catch` cannot intercept that —
/// without this helper the exception unwinds through the `@_cdecl` entry
/// point and aborts the process **before** Crashlytics' signal handlers are
/// armed, so the crash is invisible to the dashboard.
@interface FrakObjCExceptionCatcher : NSObject

/// Run `block` and return `nil` on success, or an `NSError` describing the
/// caught `NSException` on failure. `NSError.userInfo` carries the original
/// `name`, `reason`, and `callStackSymbols` for diagnostics.
///
/// Named `catchException:` (not `try:` / `tryBlock:`) so Swift's auto-rename
/// for ObjC `try`-prefixed methods doesn't kick in — we want a stable name
/// on both sides of the bridge.
+ (nullable NSError *)catchException:(__attribute__((noescape)) void (^)(void))block;

@end

NS_ASSUME_NONNULL_END
