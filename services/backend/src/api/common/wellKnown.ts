import { Elysia } from "elysia";

const iosTeamId = "57DZ6Z2235";
const iosBundleId = "id.frak.wallet";
const iosAppId = `${iosTeamId}.${iosBundleId}`;

const androidPackageName = "id.frak.wallet";

// Validate Android SHA256 fingerprint from environment
if (!process.env.ANDROID_SHA256_FINGERPRINT?.trim()) {
    throw new Error(
        "Missing required environment variable: ANDROID_SHA256_FINGERPRINT"
    );
}
const androidSha256Fingerprint = process.env.ANDROID_SHA256_FINGERPRINT;

const appleAppSiteAssociation = {
    applinks: {
        apps: [],
        details: [
            {
                appID: iosAppId,
                paths: ["/open/*"],
            },
        ],
    },
    webcredentials: {
        apps: [iosAppId],
    },
};

const assetLinks = [
    {
        relation: [
            "delegate_permission/common.handle_all_urls",
            "delegate_permission/common.get_login_creds",
        ],
        target: {
            namespace: "android_app",
            package_name: androidPackageName,
            sha256_cert_fingerprints: [androidSha256Fingerprint],
        },
    },
];

export const wellKnownRoutes = new Elysia({ name: "Routes.wellKnown" })
    .get(
        "/.well-known/apple-app-site-association",
        () => appleAppSiteAssociation
    )
    .get("/.well-known/assetlinks.json", () => assetLinks);
