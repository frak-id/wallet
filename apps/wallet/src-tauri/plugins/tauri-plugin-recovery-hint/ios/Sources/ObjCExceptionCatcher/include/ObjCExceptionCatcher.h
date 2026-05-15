#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

/// Bridges Objective-C @try/@catch into Swift.
///
/// Swift's `do/catch` only catches `Error`-conforming types thrown via `throw`.
/// AppKit / Foundation classes (here: `NSUbiquitousKeyValueStore`) can still
/// raise Objective-C `NSException` when entitlements are stale, the user is
/// signed out of iCloud in an unexpected state, or the daemon misbehaves.
/// Such exceptions are unrecoverable in pure Swift and tear down the app.
///
/// This helper wraps a Swift closure in `@try`/`@catch (NSException *)` so the
/// caller can downgrade a would-be fatal crash into a soft failure (log + skip).
@interface ObjCExceptionCatcher : NSObject

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
