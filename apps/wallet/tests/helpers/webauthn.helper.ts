import type { CDPSession, Page } from "@playwright/test";

export class WebAuthnHelper {
    constructor(private page: Page) {}

    /**
     * The current session for the virtual authenticator.
     */
    private session: CDPSession | undefined;

    private authenticatorsId: string[] = [];

    /**
     * Enables the virtual authenticator for the current browser context.
     * This must be called before any WebAuthn operations.
     */
    async enableVirtualAuthenticator() {
        this.session = await this.page.context().newCDPSession(this.page);
        await this.session.send("WebAuthn.enable");
    }

    /**
     * Adds a new passkey credential to the virtual authenticator.
     * @param {string} protocol - The protocol ('ctap2' or 'u2f').
     * @param {string} transport - The transport ('usb', 'nfc', 'ble', 'internal').
     */
    async addAuthenticator(
        protocol: "ctap2" | "u2f" = "ctap2",
        transport: "usb" | "nfc" | "ble" | "internal" = "internal"
    ) {
        if (!this.session) {
            throw new Error("Virtual authenticator is not enabled");
        }

        // todo: is this enough? credentials
        const authenticator = await this.session.send("WebAuthn.addVirtualAuthenticator", {
            options: {
                protocol,
                transport,
                hasUserVerification: true,
            },
        });
        this.authenticatorsId.push(authenticator.authenticatorId);

        return authenticator;
    }

    /**
     * Removes all credentials from the virtual authenticator.
     */
    async clearAuthenticators() {
        if (!this.session) {
            throw new Error("Virtual authenticator is not enabled");
        }

        for (const id of this.authenticatorsId) {
            await this.session.send("WebAuthn.removeVirtualAuthenticator", {
                authenticatorId: id,
            });
        }
    }

    // High-level methods to be implemented based on your app's flow
    async signUp(username: string) {
        // 1. Trigger the sign-up flow in your app's UI
        //    Example: await this.page.getByLabel('Username').fill(username);
        //             await this.page.getByRole('button', { name: 'Sign Up' }).click();
        // 2. The app will call navigator.credentials.create()
        // 3. Playwright's virtual authenticator will handle the request automatically.
        console.log(`Placeholder: Simulating sign-up for ${username}`);
    }

    async signIn(username: string) {
        // 1. Trigger the sign-in flow in your app's UI
        //    Example: await this.page.getByLabel('Username').fill(username);
        //             await this.page.getByRole('button', { name: 'Sign In' }).click();
        // 2. The app will call navigator.credentials.get()
        // 3. Playwright's virtual authenticator will handle the request.
        console.log(`Placeholder: Simulating sign-in for ${username}`);
    }
}
