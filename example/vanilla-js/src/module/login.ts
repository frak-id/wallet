import { loginModalStep } from "./config";

export function bindLoginButton() {
    const loginButton = document.getElementById("login-button");
    loginButton?.addEventListener("click", handleLogin);
}

async function handleLogin() {
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
        if (!window.FrakSetup.frakClient) {
            console.error("Frak client not initialized");
            return;
        }
        await window.NexusSDK.displayModal(window.FrakSetup.frakClient, {
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
