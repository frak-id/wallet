# Frak Android SDK — privacy and Play Data Safety

What the SDK collects, where it goes, and what you must declare and wire before you ship.
The iOS counterpart is `sdk/ios/Sources/FrakSDK/PrivacyInfo.xcprivacy`; the two are kept
deliberately consistent, so a declaration written from one holds for the other.

## What the SDK collects

Three things leave the device, and only three.

| What | Play data type | Purpose | Sent when |
| --- | --- | --- | --- |
| Anonymous id (`clientId`), and the `customerId` you pass to `tracking.purchase` | Personal info → **User IDs** | App functionality | Only on tracking calls |
| Referral and sharing events (`arrival`, `sharing`, `custom`) | App activity → **App interactions** | App functionality, Analytics | `tracking.track` |
| `customerId`, `orderId`, checkout `token` | Financial info → **Purchase history** | App functionality | `tracking.purchase` |

**Not** declared, because the SDK does not touch them: advertising ID, `ANDROID_ID`,
Install Referrer, location, contacts, device or other IDs.

### Why "User IDs" and not "Device or other IDs"

The anonymous id is derived from a P-256 keypair minted per app installation and held in
the Android Keystore. It is not readable by another app, it is not device-level, and two
Frak-integrated apps on the same phone get different ids. It dies on uninstall. That makes
it an account identifier, not a device identifier. Declaring it under "Device or other IDs"
would describe your app as collecting something closer to an advertising ID, which it does
not.

### Collected vs. shared

Play distinguishes data your app *collects* (sent to your own servers) from data it
*shares* (transferred to a third party). Everything above is transmitted to Frak's backend,
not yours. Whether that counts as sharing depends on whether you treat Frak as a service
provider acting on your instructions or as an independent third party — which follows from
your contract with us, not from the code. Decide it with whoever owns your DPA, then
declare consistently.

## Where it goes

All traffic is HTTPS to the backend for the configured `FrakEnvironment`. Every request
carries `Accept`, `Content-Type` and `X-Frak-Sdk-Version`; tracking calls add
`x-frak-client-id`. As with any network call, the backend sees the device's public IP.

| Endpoint | Payload | Consent-gated |
| --- | --- | --- |
| `GET /user/merchant/resolve` | `merchantId` or `packageId`, `platform=android`, `lang` | No — carries no identifier |
| `GET` rewards | `merchantId`, `currency`, `targetInteraction`, `audience`, products | No — carries no identifier |
| `POST /user/track/interaction` | `merchantId`, `type`, plus per-type fields | Yes |
| `POST /user/track/purchase` | `merchantId`, `customerId`, `orderId`, `token` | Yes |
| `POST /user/identity/merge/execute` | `mergeToken`, `targetAnonymousId`, `merchantId`, `proof` | Yes |

`Interaction.Custom` carries an arbitrary `Map<String, String>` that the SDK persists and
transmits without inspecting. Anything you put in there is yours to declare — put an email
or an internal user id in it and the table above stops describing your app.

## What it stores on the device

| Location | Contents |
| --- | --- |
| Android Keystore, alias `id.frak.sdk.identity` | P-256 private key, non-exportable |
| SharedPreferences `id.frak.sdk` | Merchant marker, tracking-consent decision |
| SharedPreferences `id.frak.sdk.config` | Resolved merchant config cache |
| `noBackupFilesDir/frak-events.jsonl` | Queued events awaiting upload |

The two SharedPreferences files are plaintext in your app's private storage. Only the key
material is hardware-backed.

`INTERNET` is the only permission the SDK requests. It also declares `<queries>` visibility
for `id.frak.wallet` and `id.frak.wallet.dev` so the installed-wallet probe works; never
`QUERY_ALL_PACKAGES`.

## What you must wire

### 1. Consent

The SDK ships no consent UI. It exposes a switch and expects your CMP to drive it:

```kotlin
client.setTrackingEnabled(false) // stops tracking, purges anything queued
```

`FrakConfig.trackingEnabled` is a build-time floor a runtime `true` cannot lift. With no
persisted decision, the config default applies.

Two things to know before you build a compliance story on this. The decision is written
with `SharedPreferences.apply()`, so a withdrawal lost to a process kill reverts to enabled
on the next launch (finding S10). And the web SDK has no equivalent switch today, so a
notice written against this behaviour does not hold for your web integration.

### 2. Backup and device-transfer exclusion

**Required, and the SDK cannot do it for you.** `android:dataExtractionRules` (API 31+) and
`android:fullBackupContent` (API 24–30) are singular attributes on `<application>`, and the
manifest merger does not union rules files — so a library cannot set either on a consumer's
behalf. Without this step the anonymous identity is cloned onto a restored or transferred
device, resurrecting one installation's identity on another.

The SDK ships both files as resources. Reference them:

```xml
<application
    android:dataExtractionRules="@xml/frak_data_extraction_rules"
    android:fullBackupContent="@xml/frak_full_backup_content">
```

If you already set either attribute, do not swap yours out — copy the `<exclude>` entries
for `id.frak.sdk.xml` and `id.frak.sdk.config.xml` into your own rules files, in both the
`<cloud-backup>` and `<device-transfer>` blocks. `<cloud-backup>` alone still lets a
device-to-device transfer clone them verbatim. A merged manifest conflict on these
attributes needs `tools:replace`.

Nothing verifies this at build or run time yet, so it fails silently.

### 3. Data deletion route

Play requires a deletion path for apps that let users create an account. Two exist:

- `client.resetAnonymousId()` destroys the local keypair and purges the queue. It is a
  local identity rotation — events already sent stay attributed to the old id.
- Backend-held data erasure goes through <https://frak.id/account-deletion>. Use that URL
  in the Data Safety form's deletion field.

## Keeping this current

Change what the SDK sends and this file and `PrivacyInfo.xcprivacy` both go stale, silently
— nothing in CI checks either against the code. The ABI gate (`bun run --cwd sdk/android
apiCheck`) will catch a changed public signature, which is the usual signal that the table
above needs a second look.
