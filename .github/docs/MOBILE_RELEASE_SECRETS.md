# Mobile Release Secrets Setup

This document provides instructions for setting up the GitHub Secrets required by the Tauri mobile CI/CD workflow defined in `.github/workflows/tauri-mobile-release.yml`.

## Prerequisites

1. **First AAB Manual Upload**: You must manually upload the first Android App Bundle (AAB) to the Google Play Console before the automated upload API works. Automated uploads will fail until this step is completed.
2. **App Store Connect API Role**: The API key used for iOS releases must have the **App Manager** role or higher.
3. **CI Signing Key & WebAuthn**: If the CI signing key produces a different Android SHA256 fingerprint than local builds, update the fingerprint in `packages/app-essentials/src/webauthn/index.ts` for Digital Asset Links verification.

## iOS Secrets

| Secret Name | Description |
|---|---|
| `APPSTORE_ISSUER_ID` | UUID from App Store Connect -> Integrations -> Keys (displayed above the keys table). |
| `APPSTORE_API_KEY_ID` | Key ID column from the same keys page. |
| `APPSTORE_API_PRIVATE_KEY` | Full contents of the `.p8` file downloaded when creating the key. |

### Setup Steps

1. Go to [App Store Connect API Integrations](https://appstoreconnect.apple.com/access/integrations/api).
2. Click **Generate API Key** (or select an existing one).
3. Set the role to **App Manager** (minimum required).
4. Download the `.p8` file. Note that it can only be downloaded once.
5. Copy the **Key ID** and **Issuer ID**.
6. In the GitHub repository, navigate to **Settings > Secrets and variables > Actions**.
7. Add the following secrets:
    * `APPSTORE_ISSUER_ID`: Paste the Issuer UUID.
    * `APPSTORE_API_KEY_ID`: Paste the Key ID.
    * `APPSTORE_API_PRIVATE_KEY`: Paste the full contents of the `.p8` file, including the `-----BEGIN PRIVATE KEY-----` and `-----END PRIVATE KEY-----` lines.

**Notes**:
* The Team ID `57DZ6Z2235` is configured in `apps/wallet/src-tauri/tauri.conf.json`.
* Tauri uses `APPLE_API_ISSUER`, `APPLE_API_KEY`, and `APPLE_API_KEY_PATH` environment variables natively.

## Android Secrets

| Secret Name | Description |
|---|---|
| `ANDROID_KEYSTORE_BASE64` | Base64-encoded upload keystore file (`.jks`). |
| `ANDROID_KEYSTORE_PASSWORD` | Keystore password. |
| `ANDROID_KEY_PASSWORD` | Key password. |
| `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` | Google Play Developer API service account JSON key. |

### Keystore Secrets

1. Locate the keystore file at `apps/wallet/src-tauri/gen/android/upload-keystore.jks`.
2. Encode the file to base64:
   ```bash
   base64 -i apps/wallet/src-tauri/gen/android/upload-keystore.jks
   ```
3. Add `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, and `ANDROID_KEY_PASSWORD` to GitHub Secrets.

The workflow restores the keystore during CI and generates a `key.properties` file with this format:
```
storeFile=../upload-keystore.jks
storePassword=<from secret>
keyAlias=upload
keyPassword=<from secret>
```

### Google Play Service Account

1. Go to the [Google Cloud Console](https://console.cloud.google.com).
2. Create or select a project linked to your Google Play Console.
3. Enable the **Google Play Android Developer API**.
4. Create a Service Account and generate a JSON key.
5. In the [Google Play Console](https://play.google.com/console), go to **Users & Permissions**.
6. Invite the service account email and grant the **Release Manager** role (or minimum required permissions to manage releases).
7. Add `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` to GitHub Secrets and paste the full JSON key contents.

## Shared Secrets (Already Configured)

* **AWS OIDC Role**: Configured for the `deploy.yml` workflow. Role: `arn:aws:iam::262732185023:role/github-action-deploy-role`.
* **SST Secrets**: Configured for deployment workflows.

## Verification

To verify that secrets are correctly configured:

1. **iOS**: Trigger the workflow with a test version. If the APPSTORE secrets are incorrect, the TestFlight upload step will fail with authentication errors.
2. **Android Keystore**: If the base64 string is malformed or passwords are incorrect, the Android build step will fail with signing errors.
3. **Google Play**: If the service account JSON is invalid or lacks permissions, the Play Store upload step will fail with authorization errors.
4. **Quick Check**: Ensure all 7 secrets exist in **Settings > Secrets**:
    * `APPSTORE_ISSUER_ID`
    * `APPSTORE_API_KEY_ID`
    * `APPSTORE_API_PRIVATE_KEY`
    * `ANDROID_KEYSTORE_BASE64`
    * `ANDROID_KEYSTORE_PASSWORD`
    * `ANDROID_KEY_PASSWORD`
    * `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON`
