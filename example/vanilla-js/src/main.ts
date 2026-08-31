import type { FrakClient, SharingPageProduct } from "@frak-labs/core-sdk";
import {
    compressJsonToB64,
    FrakContextManager,
    getClientId,
    getClientIdAsync,
    isIOS,
    isMobile,
    sdkConfigStore,
    triggerDeepLinkWithFallback,
} from "@frak-labs/core-sdk";
import { displayModal, displaySharingPage } from "@frak-labs/core-sdk/actions";

function log(
    message: string,
    type: "info" | "warn" | "error" | "success" = "info",
    statusBoxId = "merge-status"
) {
    const statusBox = document.getElementById(statusBoxId);
    if (!statusBox) return;

    const timestamp = new Date().toLocaleTimeString();
    const div = document.createElement("div");
    div.className = type;
    div.textContent = `[${timestamp}] ${message}`;
    statusBox.appendChild(div);
    statusBox.scrollTop = statusBox.scrollHeight;
}

async function updateClientIdDisplay() {
    const display = document.getElementById("current-client-id");
    if (!display) return;

    // Derivation is async (P-256 keygen), so show a placeholder while it runs.
    display.textContent = getClientId() ?? "(deriving…)";
    try {
        display.textContent = await getClientIdAsync();
    } catch (e) {
        display.textContent = "(derivation failed)";
        log(`Client ID derivation failed: ${e}`, "error");
    }
}

function checkForMergeToken() {
    const url = new URL(window.location.href);
    const mergeToken = url.searchParams.get("fmt");

    if (mergeToken) {
        log("Merge token detected in URL!", "success");
        log(`Token: ${mergeToken.substring(0, 50)}...`, "info");
        log(
            "Listener will auto-process this token and link identities",
            "info"
        );
    }
}

function handleClearId() {
    if (window.localStorage) {
        localStorage.removeItem("frak-client-id");
    }
    log("Client ID cleared - refreshing to get new ID...", "info");
    setTimeout(() => window.location.reload(), 500);
}

function waitForClient(): Promise<FrakClient> {
    if (window.FrakSetup?.client) {
        return Promise.resolve(window.FrakSetup.client);
    }
    return new Promise((resolve) => {
        // Keep listening until a client actually lands — the event can fire first.
        const onClient = () => {
            const client = window.FrakSetup?.client;
            if (!client) return;
            window.removeEventListener("frak:client", onClient);
            resolve(client);
        };
        window.addEventListener("frak:client", onClient);
    });
}

async function handleModalWithPlacement(
    placement: string | undefined,
    statusBoxId: string
) {
    const label = placement ?? "none";
    log(`Triggering modal with placement="${label}"...`, "info", statusBoxId);

    const client = await waitForClient();

    try {
        const result = await displayModal(
            client,
            {
                steps: {
                    login: { allowSso: true },
                    final: {
                        action: { key: "reward" },
                    },
                },
                metadata: {
                    header: {
                        title: `Test — placement: ${label}`,
                    },
                },
            },
            placement
        );
        log(
            `Modal completed: ${JSON.stringify(result)}`,
            "success",
            statusBoxId
        );
    } catch (e) {
        log(`Modal error: ${e}`, "error", statusBoxId);
    }
}

async function handleSharingPage(withProduct: boolean) {
    const statusBoxId = "sharing-page-status";
    log(
        `Opening sharing page${withProduct ? " (with product)" : ""}...`,
        "info",
        statusBoxId
    );

    const client = await waitForClient();

    try {
        const result = await displaySharingPage(
            client,
            withProduct
                ? {
                      products: [
                          {
                              title: "Babies camel cuir velours bout carré",
                              imageUrl:
                                  "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=200",
                              link: "https://example.com/product-1",
                          },
                          {
                              title: "Sneakers blanches classiques",
                              imageUrl:
                                  "https://images.unsplash.com/photo-1549298916-b41d501d3772?w=200",
                              link: "https://example.com/product-2",
                          },
                          {
                              title: "Boots en cuir noir",
                              imageUrl:
                                  "https://images.unsplash.com/photo-1608256246200-53e635b5b65f?w=200",
                              link: "https://example.com/product-3",
                          },
                      ],
                  }
                : {}
        );
        log(
            `Sharing page result: ${JSON.stringify(result)}`,
            "success",
            statusBoxId
        );
    } catch (e) {
        log(`Sharing page error: ${e}`, "error", statusBoxId);
    }
}

const sampleProducts: SharingPageProduct[] = [
    {
        title: "Babies camel cuir velours bout carré",
        imageUrl:
            "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=200",
        link: "https://example.com/product-1",
    },
    {
        title: "Sneakers blanches classiques",
        imageUrl:
            "https://images.unsplash.com/photo-1549298916-b41d501d3772?w=200",
        link: "https://example.com/product-2",
    },
];

function buildShareLink(
    params: { products?: SharingPageProduct[]; link?: string } = {}
): string {
    const url = new URL(window.location.href);
    // Strip existing query so each generated link is reproducible.
    url.search = "";
    url.searchParams.set("frakAction", "share");
    if (params.link) url.searchParams.set("link", params.link);
    if (params.products?.length) {
        url.searchParams.set("products", compressJsonToB64(params.products));
    }
    return url.toString();
}

async function copyShareLink(text: string, label: string) {
    const statusBoxId = "share-link-status";
    try {
        await navigator.clipboard.writeText(text);
        log(`${label} link copied to clipboard`, "success", statusBoxId);
    } catch (e) {
        log(`Copy failed: ${e}`, "error", statusBoxId);
    }
}

function bindShareLinkSamples() {
    const noProductLink = buildShareLink();
    const withProductLink = buildShareLink({
        link: "https://example.com",
        products: sampleProducts,
    });

    const samples: Array<{
        label: string;
        link: string;
        codeId: string;
        openId: string;
        copyId: string;
    }> = [
        {
            label: "No-product",
            link: noProductLink,
            codeId: "share-link-no-product",
            openId: "open-share-link-no-product",
            copyId: "btn-copy-share-link-no-product",
        },
        {
            label: "With-products",
            link: withProductLink,
            codeId: "share-link-with-product",
            openId: "open-share-link-with-product",
            copyId: "btn-copy-share-link-with-product",
        },
    ];

    for (const sample of samples) {
        const codeEl = document.getElementById(sample.codeId);
        if (codeEl) codeEl.textContent = sample.link;
        const openEl = document.getElementById(
            sample.openId
        ) as HTMLAnchorElement | null;
        if (openEl) openEl.href = sample.link;
        document
            .getElementById(sample.copyId)
            ?.addEventListener("click", () =>
                copyShareLink(sample.link, sample.label)
            );
    }
}

/**
 * Merchant id both native harnesses initialize with. The native SDK drops an arrival whose
 * `fCtx` merchant differs from the app's own, so the link can't carry this site's merchant.
 */
const NATIVE_EXAMPLE_MERCHANT_ID = "0a799880-ba54-4276-a734-db8721911bab";

/**
 * The only scheme both harnesses actually receive: iOS has no associated-domains entitlement,
 * and the Android `https://example-merchant.com/product` filter has no `autoVerify`.
 */
const NATIVE_APP_SCHEME = "merchantapp://";
const NATIVE_APP_TARGET = `${NATIVE_APP_SCHEME}product`;

type NativePlatform = "ios" | "android";

const nativePlatforms: Record<
    NativePlatform,
    { label: string; buttonId: string; linkId: string }
> = {
    ios: {
        label: "iOS",
        buttonId: "btn-share-native-ios",
        linkId: "native-link-ios",
    },
    android: {
        label: "Android",
        buttonId: "btn-share-native-android",
        linkId: "native-link-android",
    },
};

/** `isMobile()` also matches webOS/BlackBerry, so Android needs its own check. */
function detectNativePlatform(): NativePlatform | null {
    if (!isMobile()) return null;
    if (isIOS) return "ios";
    return /Android/i.test(navigator.userAgent) ? "android" : null;
}

/**
 * Build the `fCtx`-carrying deep link the native SDK decodes. Same builder the wallet uses
 * for web share links — only the base URL changes, from an https page to the app scheme.
 */
async function buildNativeReferralLink(
    platform: NativePlatform
): Promise<string | null> {
    const clientId = await getClientIdAsync();
    return FrakContextManager.update({
        url: NATIVE_APP_TARGET,
        context: {
            v: 2,
            m: NATIVE_EXAMPLE_MERCHANT_ID,
            t: Math.floor(Date.now() / 1000),
            c: clientId,
        },
        attribution: {
            utmMedium: "native-app",
            utmCampaign: `${platform}-example`,
        },
    });
}

/**
 * Chromium on Android shows a "Continue to app?" bar for custom schemes; `intent://` skips it.
 *
 * `package=` is deliberately omitted: with it Chrome jumps to the Play Store (where these
 * harnesses are not published) and the visibility-based fallback never fires.
 */
function toAndroidIntentUrl(link: string): string {
    const isChromiumAndroid =
        /Android/i.test(navigator.userAgent) &&
        /Chrome\/\d+/i.test(navigator.userAgent);
    if (!isChromiumAndroid) return link;
    const scheme = NATIVE_APP_SCHEME.replace("://", "");
    return `intent://${link.slice(NATIVE_APP_SCHEME.length)}#Intent;scheme=${scheme};end`;
}

async function handleNativeShare(platform: NativePlatform) {
    const statusBoxId = "native-share-status";
    const { label } = nativePlatforms[platform];
    const link = await buildNativeReferralLink(platform);
    if (!link) {
        log(`Could not build the ${label} referral link`, "error", statusBoxId);
        return;
    }

    // Off-platform (desktop, or Android looking at the iOS link): hand the link over instead
    // of navigating to a scheme nothing here can open.
    if (detectNativePlatform() !== platform) {
        if (navigator.share) {
            await navigator.share({ url: link });
            log(
                `${label} link handed to the share sheet`,
                "success",
                statusBoxId
            );
            return;
        }
        await copyShareLink(link, `${label} app`);
        return;
    }

    log(`Opening the ${label} example app…`, "info", statusBoxId);
    triggerDeepLinkWithFallback(
        platform === "android" ? toAndroidIntentUrl(link) : link,
        {
            onFallback: () =>
                log(
                    `The ${label} example app doesn't seem installed — build & run example/native-${platform}`,
                    "warn",
                    statusBoxId
                ),
        }
    );
}

async function bindNativeShareButtons() {
    const statusBoxId = "native-share-status";
    const platform = detectNativePlatform();
    log(
        platform
            ? `Detected ${nativePlatforms[platform].label} — its button opens the app directly`
            : "Not on iOS/Android — both buttons fall back to the share sheet or clipboard",
        "info",
        statusBoxId
    );

    const siteMerchantId = sdkConfigStore.getMerchantId();
    if (siteMerchantId && siteMerchantId !== NATIVE_EXAMPLE_MERCHANT_ID) {
        log(
            `This site resolves to merchant ${siteMerchantId}; links are built for the native example merchant ${NATIVE_EXAMPLE_MERCHANT_ID}`,
            "warn",
            statusBoxId
        );
    }

    for (const [key, target] of Object.entries(nativePlatforms)) {
        const nativePlatform = key as NativePlatform;
        document
            .getElementById(target.buttonId)
            ?.addEventListener("click", () =>
                handleNativeShare(nativePlatform)
            );

        const codeEl = document.getElementById(target.linkId);
        if (!codeEl) continue;
        const preview = await buildNativeReferralLink(nativePlatform);
        codeEl.textContent = preview ?? "(link unavailable)";
    }
}

function bindTestButtons() {
    document
        .getElementById("btn-modal-no-placement")
        ?.addEventListener("click", () =>
            handleModalWithPlacement(undefined, "modal-placement-status")
        );
    document
        .getElementById("btn-modal-hero")
        ?.addEventListener("click", () =>
            handleModalWithPlacement("hero-share", "modal-placement-status")
        );
    document
        .getElementById("btn-modal-sidebar")
        ?.addEventListener("click", () =>
            handleModalWithPlacement("sidebar-promo", "modal-placement-status")
        );
    document
        .getElementById("btn-sharing-page")
        ?.addEventListener("click", () => handleSharingPage(false));
    document
        .getElementById("btn-sharing-page-product")
        ?.addEventListener("click", () => handleSharingPage(true));
    bindShareLinkSamples();
    void bindNativeShareButtons();
}

function init() {
    void updateClientIdDisplay();
    checkForMergeToken();
    bindTestButtons();

    document
        .getElementById("btn-clear-id")
        ?.addEventListener("click", handleClearId);
}

init();
