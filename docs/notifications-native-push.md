# Native Push Notifications — Next Steps

## Current State

The notification system uses a **platform-agnostic adapter pattern** that abstracts notification logic behind a common `NotificationAdapter` interface:

```
getNotificationAdapter() (memoized singleton)
        |
        | isTauri()?
   ┌────┴─────┐
   |          |
   v          v
 Web        Tauri
Adapter     Adapter
```

### What works today

| Capability | Web | Tauri (Android/iOS) |
|---|---|---|
| Permission request | Browser Notification API | `@tauri-apps/plugin-notification` |
| Remote push delivery | Web Push (VAPID + Service Worker) | **Not implemented** |
| Local notifications | No-op (handled by Service Worker) | Native OS notifications |
| Backend token sync | Push subscription synced to backend | **Not implemented** |
| Notification storage | IndexedDB (service worker + app) | IndexedDB (app only) |

### Key files

- `packages/wallet-shared/src/common/notification/adapter.ts` — `NotificationAdapter` type + factory
- `packages/wallet-shared/src/common/notification/webAdapter.ts` — Web Push implementation
- `packages/wallet-shared/src/common/notification/tauriAdapter.ts` — Tauri native implementation
- `services/backend/src/domain/notifications/` — Backend notification service (web-push)
- `apps/wallet/app/service-worker.ts` — Service Worker push handler

## What needs to be done

### 1. Integrate Firebase Cloud Messaging (FCM) for Android

The Tauri Android app needs FCM to receive remote push notifications.

**Tauri adapter changes** (`tauriAdapter.ts`):
- `subscribe()`: Register with FCM, obtain a device token
- `unsubscribe()`: Unregister from FCM
- `isSubscribed()`: Check FCM registration status
- `initialize()`: Initialize FCM SDK and retrieve existing token

**Backend changes**:
- Store FCM tokens alongside web push tokens in `push_tokens` table (add a `type` column: `web-push` | `fcm`)
- Add FCM sender in `NotificationsService` using Firebase Admin SDK
- Route notifications to the correct sender based on token type

**Tauri/Rust side**:
- Add `tauri-plugin-notification` FCM support or a dedicated FCM plugin
- Forward FCM token to the JS layer via Tauri events or commands

### 2. Integrate FCM for iOS (via Firebase + APNs)

Firebase Admin SDK handles APNs delivery transparently — both Android and iOS use **FCM registration tokens**, not raw APNs device tokens. The adapter code is the same on both platforms.

**Tauri adapter changes** (`tauriAdapter.ts`):
- Same as Android — obtain and sync FCM registration token
- Handle iOS-specific permission flow (provisional notifications, etc.)

**iOS-specific setup** (Xcode project, not `tauri.conf.json`):
- Enable Push Notifications capability in the Xcode project entitlements
- Configure APNs key/certificate in the Firebase Console
- Add provisioning profile with push notification entitlement

### 3. Unify backend notification sending

The backend `NotificationsService.sendNotification()` currently only uses the `web-push` library. It needs to become a dispatcher:

```
sendNotification(wallets, payload)
    |
    ├── web-push tokens → web-push library
    └── FCM tokens → Firebase Admin SDK (handles both Android + iOS)
```

Both Android and iOS use FCM registration tokens, so the backend only needs two senders: `web-push` + `firebase-admin`.

### 4. Database schema changes

`push_tokens` table needs:
- `type` column (`web-push` | `fcm`) to differentiate token types
- FCM tokens are simple strings (unlike web push which has endpoint + keys)
- Consider a `device_id` column to allow multiple devices per wallet

### 5. Token lifecycle

- **Token refresh**: FCM tokens can be rotated by the OS. The adapter needs to handle token refresh events and re-sync to the backend.
- **Token cleanup**: Extend `cleanupExpiredTokens()` to handle FCM token invalidation (e.g., `messaging/registration-token-not-registered` error from FCM).
