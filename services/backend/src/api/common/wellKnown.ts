import { Elysia } from "elysia";

const iosTeamId = "6Y48FFCGMY";
const iosBundleId = "id.frak.wallet";
const iosAppId = `${iosTeamId}.${iosBundleId}`;

const androidPackageName = "id.frak.wallet";
const androidSha256Fingerprint =
    "27:90:64:91:13:5E:40:88:D8:C2:5B:42:6A:AE:56:E0:42:88:E4:18:F8:5F:DA:40:F2:BC:6E:7A:90:F6:E1:24";

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
