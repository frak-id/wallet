import type { WalletStatusReturnType } from "@frak-labs/nexus-sdk/core";

export function displayWalletStatus() {
    const statusElement = document.getElementById("wallet-status");
    if (!statusElement) {
        console.error("Wallet status element not found");
        return;
    }
    statusElement.textContent = "Checking wallet status...";

    if (!window.NexusSDK.client) {
        console.error("Frak client not initialized");
        return;
    }
    window.NexusSDK.watchWalletStatus(
        window.NexusSDK.client,
        (status: WalletStatusReturnType) => {
            console.log("Wallet status:", status);

            // Set the status text
            statusElement.textContent = `Wallet status: ${status.key === "connected" ? "Connected" : "Not connected"}`;

            // Enable the login button if the wallet is not connected
            const loginButton = document.getElementById(
                "login-button"
            ) as HTMLButtonElement | null;
            if (!loginButton) {
                console.error("Login button not found");
                return;
            }
            loginButton.disabled = status.key === "connected";
        }
    ).catch((error: Error) => {
        statusElement.textContent = `Error: ${error.message}`;
    });
}
