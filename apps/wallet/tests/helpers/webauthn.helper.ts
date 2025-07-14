import { readFileSync, writeFileSync } from "node:fs";
import type { CDPSession, Page } from "@playwright/test";
import { AUTHENTICATOR_STATE } from "../../playwright.config";

/**
 * Helper for semi-real webauthn authentication
 *
 * Warning:
 *  - Only work on chromium devices
 *  - Create a new authenticator on each page (so not reusable between test + add a new authenticator in our db for each test run)
 */
export class WebAuthNHelper {
    private cdpSession?: CDPSession = undefined;
    public authenticatorId?: string = undefined;

    constructor(private readonly page: Page) {}

    async setup() {
        if (this.cdpSession && this.authenticatorId) {
            // Already setup
            console.log("WebAuthNHelper already setup");
            return;
        }

        // Enable webauthn and register a virtual authenticator
        this.cdpSession = await this.page.context().newCDPSession(this.page);
        await this.cdpSession.send("WebAuthn.enable");

        // Add a virtual authenticator
        const { authenticatorId } = await this.cdpSession.send(
            "WebAuthn.addVirtualAuthenticator",
            {
                options: {
                    protocol: "ctap2",
                    ctap2Version: "ctap2_1",
                    transport: "usb",
                    hasUserVerification: true,
                    hasResidentKey: true,
                    automaticPresenceSimulation: true,
                    isUserVerified: true,
                    // Set backup options
                    // defaultBackupEligibility: true,
                    // defaultBackupState: true,
                },
            }
        );
        this.authenticatorId = authenticatorId;
    }

    async cleanup() {
        console.log("WebAuthNHelper cleanup");
        if (!this.cdpSession) {
            console.error("WebAuthNHelper not setup");
            return;
        }

        // Disable webauthn
        await this.cdpSession.send("WebAuthn.disable");

        // Remove the authenticator
        if (this.authenticatorId) {
            await this.cdpSession.send("WebAuthn.clearCredentials", {
                authenticatorId: this.authenticatorId,
            });
            await this.cdpSession.send("WebAuthn.removeVirtualAuthenticator", {
                authenticatorId: this.authenticatorId,
            });
            this.authenticatorId = undefined;
        }

        this.cdpSession.detach();
        this.cdpSession = undefined;
    }

    async setUserVerified(isUserVerified: boolean) {
        if (!this.cdpSession || !this.authenticatorId) {
            console.error("WebAuthNHelper not setup");
            return;
        }
        await this.cdpSession.send("WebAuthn.setUserVerified", {
            authenticatorId: this.authenticatorId,
            isUserVerified,
        });
    }

    async getCredentials() {
        if (!this.cdpSession || !this.authenticatorId) {
            console.error("WebAuthNHelper not setup");
            return;
        }
        const { credentials } = await this.cdpSession.send(
            "WebAuthn.getCredentials",
            {
                authenticatorId: this.authenticatorId,
            }
        );
        return credentials;
    }

    async saveAuthenticatorState() {
        if (!this.cdpSession || !this.authenticatorId) {
            console.error("WebAuthNHelper not setup");
            return;
        }

        const jsonOutput = {
            authenticatorId: this.authenticatorId,
            credentials: await this.getCredentials(),
        };

        // Save the authenticator state to the file
        writeFileSync(AUTHENTICATOR_STATE, JSON.stringify(jsonOutput, null, 2));
    }

    // Even if we don't reuse the same authenticator, the credentials public key will be different, so we need to restore them
    async restoreAuthenticatorState() {
        const jsonInput = readFileSync(AUTHENTICATOR_STATE, "utf-8");
        const { authenticatorId, credentials } = JSON.parse(jsonInput);
        this.authenticatorId = authenticatorId;
        await this.cdpSession?.send("WebAuthn.addCredential", {
            authenticatorId,
            credential: credentials[0],
        });
    }
}
