import { getClientId } from "@frak-labs/core-sdk";

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
        .getElementById("btn-clear-id")
        ?.addEventListener("click", handleClearId);
}

init();
