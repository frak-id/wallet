import type {
    NexusClient,
    WalletStatusReturnType,
} from "@frak-labs/nexus-sdk/core";

const nexusConfig = {
    walletUrl: "https://localhost:3000",
    metadata: {
        name: "Your App Name",
    },
    domain: window.location.host,
};

const loginModalStep = {
    allowSso: true as true,
    ssoMetadata: {
        logoUrl: "https://news-paper.xyz/assets/logo-good-vibes.svg",
        homepageLink: "https://news-paper.xyz/",
    },
};

function setupNexusClient(): Promise<NexusClient | null> {
    return new Promise((resolve) => {
        window.NexusSDK.createIframe({
            walletBaseUrl: nexusConfig.walletUrl,
        }).then((iframe) => {
            if (iframe) {
                resolve(
                    window.NexusSDK.createIFrameNexusClient({
                        config: nexusConfig,
                        iframe,
                    })
                );
            } else {
                resolve(null);
            }
        });
    });
}

function modalShare() {
    const finalAction = {
        key: "sharing",
        options: {
            popupTitle: "Share this article with your friends",
            text: "Discover this awesome article",
            link: typeof window !== "undefined" ? window.location.href : "",
        },
    } as const;
    if (!window.NexusSetup.nexusClient) {
        console.error("Nexus client not initialized");
        return;
    }
    window.NexusSDK.displayModal(window.NexusSetup.nexusClient, {
        metadata: {
            lang: "fr",
            isDismissible: true,
        },
        steps: {
            login: loginModalStep,
            openSession: {},
            final: {
                action: finalAction,
            },
        },
    });
}

// Export the setup function and config for use in other files
window.NexusSetup = { nexusConfig, nexusClient: null, modalShare };

// wallet-status.js
function displayWalletStatus() {
    const statusElement = document.getElementById("wallet-status");
    if (!statusElement) {
        console.error("Wallet status element not found");
        return;
    }
    statusElement.textContent = "Checking wallet status...";

    if (!window.NexusSetup.nexusClient) {
        console.error("Nexus client not initialized");
        return;
    }
    window.NexusSDK.watchWalletStatus(
        window.NexusSetup.nexusClient,
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

            const shareButton = document.getElementById(
                "share-button"
            ) as HTMLButtonElement | null;
            if (!shareButton) {
                console.error("Share button not found");
                return;
            }
            shareButton.disabled = status.key === "not-connected";
        }
    ).catch((error: Error) => {
        statusElement.textContent = `Error: ${error.message}`;
    });
}

async function handleLogin() {
    const client = await setupNexusClient();
    if (!client) {
        console.error("Nexus client not initialized");
        return;
    }

    const loginButton = document.getElementById(
        "login-button"
    ) as HTMLButtonElement | null;

    if (!loginButton) {
        console.error("Login button not found");
        return;
    }

    loginButton.disabled = true;
    loginButton.textContent = "Logging in...";

    try {
        if (!window.NexusSetup.nexusClient) {
            console.error("Nexus client not initialized");
            return;
        }
        await window.NexusSDK.displayModal(window.NexusSetup.nexusClient, {
            metadata: {
                lang: "fr",
                isDismissible: true,
            },
            steps: {
                login: loginModalStep,
                openSession: {},
            },
        });
        loginButton.textContent = "Logged In";
    } catch (error) {
        console.error("Login error:", error);
        loginButton.textContent = "Login Failed";
    } finally {
        loginButton.disabled = false;
    }
}

document.addEventListener("DOMContentLoaded", () => {
    console.log("NexusSDK", window.NexusSDK);
    setupNexusClient().then((nexusClient) => {
        console.log("nexusClient", nexusClient);
        if (!nexusClient) {
            console.error("Failed to create Nexus client");
            return;
        }

        window.NexusSetup.nexusClient = nexusClient;

        window.NexusSDK.referralInteraction(nexusClient, {
            modalConfig: {
                steps: {
                    login: loginModalStep,
                    openSession: {},
                    final: {
                        action: { key: "reward" },
                    },
                },
                metadata: {
                    lang: "fr",
                    isDismissible: true,
                },
            },
            options: {
                alwaysAppendUrl: true,
            },
        }).then((referral: unknown) => {
            console.log("referral", referral);
        });

        displayWalletStatus();

        const loginButton = document.getElementById("login-button");
        loginButton?.addEventListener("click", handleLogin);
    });
});
