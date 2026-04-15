import type { FrakClient } from "@frak-labs/core-sdk";
import { getClientId } from "@frak-labs/core-sdk";
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

function updateClientIdDisplay() {
    const display = document.getElementById("current-client-id");
    if (display) {
        display.textContent = getClientId();
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
        window.addEventListener(
            "frak:client",
            () => {
                if (window.FrakSetup?.client) {
                    resolve(window.FrakSetup.client);
                }
            },
            { once: true }
        );
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
}

async function init() {
    if (!process.env.USE_CDN) {
        await Promise.all([
            import("@frak-labs/components/dist/buttonWallet.js"),
            import("@frak-labs/components/dist/buttonShare.js"),
            import("@frak-labs/components/dist/openInApp.js"),
            import("@frak-labs/components/dist/postPurchase.js"),
        ]);
    }

    updateClientIdDisplay();
    checkForMergeToken();
    bindTestButtons();

    document
        .getElementById("btn-clear-id")
        ?.addEventListener("click", handleClearId);
}

init();
