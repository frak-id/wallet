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
        if (!window.NexusSDK.modalBuilderSteps) {
            console.error("Frak client not initialized");
            return;
        }
        await window.NexusSDK.modalBuilderSteps.display();
        loginButton.textContent = "Logged In";
    } catch (error) {
        console.error("Login error:", error);
        loginButton.textContent = "Login Failed";
    } finally {
        loginButton.disabled = false;
    }
}
