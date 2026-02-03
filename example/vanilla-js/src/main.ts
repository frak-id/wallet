import {
    type FrakWalletSdkConfig,
    generateMergeToken,
    getClientId,
} from "@frak-labs/core-sdk";

declare const window: Window & { FrakSetup?: { config: FrakWalletSdkConfig } };

function getConfig(): FrakWalletSdkConfig {
    return (
        window.FrakSetup?.config ?? {
            walletUrl: "https://wallet-dev.frak.id",
            metadata: { name: "Vanilla JS" },
        }
    );
}

function log(
    message: string,
    type: "info" | "warn" | "error" | "success" = "info"
) {
    const statusBox = document.getElementById("merge-status");
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
        log("SDK will auto-process this token and link identities", "info");

        url.searchParams.delete("fmt");
        window.history.replaceState({}, "", url.toString());
        log("URL cleaned (token removed from address bar)", "info");
    }
}

async function handleGenerateToken() {
    const btn = document.getElementById(
        "btn-generate-token"
    ) as HTMLButtonElement;
    const tokenDisplay = document.getElementById("token-display");

    btn.disabled = true;
    log("Generating merge token...", "info");

    try {
        const config = getConfig();
        const token = await generateMergeToken(config);

        if (token) {
            log("Merge token generated successfully!", "success");
            if (tokenDisplay) {
                tokenDisplay.style.display = "block";
                tokenDisplay.textContent = token;
            }
        } else {
            log(
                "Failed to generate token (backend may not be running)",
                "warn"
            );
        }
    } catch (error) {
        log(`Error: ${error}`, "error");
    } finally {
        btn.disabled = false;
    }
}

function handleSimulateRedirect() {
    const tokenDisplay = document.getElementById("token-display");
    const token = tokenDisplay?.textContent;

    if (!token || token === "") {
        log("Generate a token first!", "warn");
        return;
    }

    const currentUrl = new URL(window.location.href);
    currentUrl.searchParams.set("fmt", token);

    log(`Redirecting to: ${currentUrl.toString().substring(0, 80)}...`, "info");

    window.location.href = currentUrl.toString();
}

function handleClearId() {
    if (window.localStorage) {
        localStorage.removeItem("frak-client-id");
    }
    log("Client ID cleared - refreshing to get new ID...", "info");
    setTimeout(() => window.location.reload(), 500);
}

async function init() {
    if (!process.env.USE_CDN) {
        await Promise.all([
            import("@frak-labs/components/dist/buttonWallet.js"),
            import("@frak-labs/components/dist/buttonWallet.css"),
            import("@frak-labs/components/dist/buttonShare.js"),
            import("@frak-labs/components/dist/buttonShare.css"),
            import("@frak-labs/components/dist/openInApp.js"),
            import("@frak-labs/components/dist/openInApp.css"),
        ]);
    }

    updateClientIdDisplay();
    checkForMergeToken();

    document
        .getElementById("btn-generate-token")
        ?.addEventListener("click", handleGenerateToken);
    document
        .getElementById("btn-simulate-redirect")
        ?.addEventListener("click", handleSimulateRedirect);
    document
        .getElementById("btn-clear-id")
        ?.addEventListener("click", handleClearId);
}

init();
