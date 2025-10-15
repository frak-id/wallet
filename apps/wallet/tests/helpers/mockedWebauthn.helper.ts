import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { p256 } from "@noble/curves/p256";
import type { Frame, Page } from "@playwright/test";
import type {
    AuthenticationCredential,
    RegistrationCredential,
} from "@simplewebauthn/browser";
import { isoCBOR } from "@simplewebauthn/server/helpers";
// import { encodeOne } from "cbor";
import { AUTHENTICATOR_STATE } from "../../playwright.config";
import {
    getAuthenticationResponse,
    getRegistrationResponse,
} from "./webauthn/signature";
import type {
    CreateResponse,
    CredentialProps,
    GetResponse,
} from "./webauthn/types";
import {
    EC2_SHA256_ALGO,
    EC2_TYPE,
    toStringCredentialProps,
} from "./webauthn/utils";

// The chromium aaguid is used to identify the authenticator
const CHROMIUM_AAGUID = "b5397666-4885-aa6b-cebf-e52262a439a2";

declare global {
    interface Window {
        frak_mockedWebAuthNCounter: number | undefined;
    }
}

/**
 * Helper for mocked webauthn authentication
 *
 * Warning:
 *  - Here we are mocking the webauthn flow
 *  - Not representative of end user UX
 *  - Good for fast testing when we are sure that webauthn is working as expected (the browser api called with the right stuff)
 */
export class MockedWebAuthNHelper {
    private credentialProps?: CredentialProps;
    private readonly authenticatorFile: string;

    constructor(
        private readonly page: Page,
        options: { context?: string } = {}
    ) {
        if (options.context) {
            this.authenticatorFile = `${AUTHENTICATOR_STATE.replace(".json", "")}-${options.context}.json`;
        } else {
            this.authenticatorFile = AUTHENTICATOR_STATE;
        }
    }

    async setup() {
        // Restore credentials
        this.restoreCredentialProps();

        // If none found, generate new ones
        if (!this.credentialProps) {
            this.credentialProps = this.generateCredentialProp();
            this.saveCredentialProps();
        }

        // Expose the functions to the browser context
        await this.page.exposeFunction(
            "credentialsCreate",
            getRegistrationResponse
        );
        await this.page.exposeFunction(
            "credentialsGet",
            getAuthenticationResponse
        );

        // Add the init script
        await this.page.addInitScript(
            ({ credentialProps }) => {
                function incrementCounter() {
                    window.frak_mockedWebAuthNCounter =
                        (window.frak_mockedWebAuthNCounter || 0) + 1;
                }

                // Helper to convert base64url to buffer
                function base64URLStringToBuffer(
                    base64URLString: string
                ): ArrayBuffer {
                    // Convert from Base64URL to Base64
                    const base64 = base64URLString
                        .replace(/-/g, "+")
                        .replace(/_/g, "/");
                    /**
                     * Pad with '=' until it's a multiple of four
                     * (4 - (85 % 4 = 1) = 3) % 4 = 3 padding
                     * (4 - (86 % 4 = 2) = 2) % 4 = 2 padding
                     * (4 - (87 % 4 = 3) = 1) % 4 = 1 padding
                     * (4 - (88 % 4 = 0) = 4) % 4 = 0 padding
                     */
                    const padLength = (4 - (base64.length % 4)) % 4;
                    const padded = base64.padEnd(
                        base64.length + padLength,
                        "="
                    );

                    // Convert to a binary string
                    const binary = atob(padded);

                    // Convert binary string to buffer
                    const buffer = new ArrayBuffer(binary.length);
                    const bytes = new Uint8Array(buffer);

                    for (let i = 0; i < binary.length; i++) {
                        bytes[i] = binary.charCodeAt(i);
                    }

                    return buffer;
                }

                // Convert a buffer to a base64url string
                function bufferToBase64URLString(buffer: ArrayBuffer): string {
                    const bytes = new Uint8Array(buffer);
                    let str = "";

                    for (const charCode of bytes) {
                        str += String.fromCharCode(charCode);
                    }

                    const base64String = btoa(str);

                    return base64String
                        .replace(/\+/g, "-")
                        .replace(/\//g, "_")
                        .replace(/=/g, "");
                }

                // Mock the webauthn credential creation
                navigator.credentials.create = async (options) => {
                    incrementCounter();

                    const challenge = options?.publicKey?.challenge;
                    if (!challenge) {
                        throw new Error("No challenge found");
                    }
                    // Get the initial credential response via browser call
                    // @ts-expect-error
                    const response = (await window.credentialsCreate(
                        options,
                        credentialProps,
                        bufferToBase64URLString(
                            challenge as unknown as ArrayBuffer
                        ),
                        window.location.origin
                    )) as CreateResponse;
                    if (!response) {
                        return null;
                    }

                    // Map it
                    return {
                        id: response.id,
                        type: response.type,
                        rawId: response.rawId,
                        authenticatorAttachment:
                            response.authenticatorAttachment,
                        response: {
                            attestationObject: base64URLStringToBuffer(
                                response.response.attestationObject
                            ),
                            clientDataJSON: base64URLStringToBuffer(
                                response.response.clientDataJSON
                            ),
                            getPublicKey: () =>
                                base64URLStringToBuffer(
                                    response.response.publicKey
                                ),
                            getPublicKeyAlgorithm: () =>
                                response.response.publicKeyAlgorithm,
                            getTransports: () => response.response.transports,
                            getAuthenticatorData: () =>
                                base64URLStringToBuffer(
                                    response.response.authenticatorData
                                ),
                        },
                        getClientExtensionResults: () => ({
                            credProps: {
                                rk: true,
                            },
                        }),
                    } satisfies RegistrationCredential;
                };

                // Mock webauthn credential get
                navigator.credentials.get = async (options) => {
                    // Increment the counter
                    incrementCounter();

                    const challenge = options?.publicKey?.challenge;
                    if (!challenge) {
                        throw new Error("No challenge found");
                    }
                    // Get the initial credential response via browser call
                    // @ts-expect-error
                    const response = (await window.credentialsGet(
                        options,
                        credentialProps,
                        bufferToBase64URLString(
                            challenge as unknown as ArrayBuffer
                        ),
                        window.location.origin
                    )) as GetResponse;
                    if (!response) {
                        return null;
                    }

                    // Map it
                    return {
                        id: response.id,
                        type: response.type,
                        rawId: response.rawId,
                        authenticatorAttachment:
                            response.authenticatorAttachment,
                        response: {
                            authenticatorData: base64URLStringToBuffer(
                                response.response.authenticatorData
                            ),
                            signature: base64URLStringToBuffer(
                                response.response.signature
                            ),
                            userHandle: base64URLStringToBuffer(
                                response.response.userHandle
                            ),
                            clientDataJSON: base64URLStringToBuffer(
                                response.response.clientDataJSON
                            ),
                        },
                        getClientExtensionResults: () => ({
                            credProps: {
                                rk: true,
                            },
                        }),
                    } satisfies AuthenticationCredential;
                };
            },
            { credentialProps: toStringCredentialProps(this.credentialProps) }
        );
    }

    /**
     * Get the COSE public key of the current credential
     */
    private cosePublicKeyCBOR(publicKey: Uint8Array) {
        // Convert public key to uncompressed point
        const x = publicKey.slice(1, 33);
        const y = publicKey.slice(33, 65);

        const COSEKey = new Map<number, number | Uint8Array>();
        COSEKey.set(1, EC2_TYPE); // Key type: EC2
        COSEKey.set(3, EC2_SHA256_ALGO); // Algorithm: ECDSA w/ SHA-256
        COSEKey.set(-1, 1); // Curve: P-256
        COSEKey.set(-2, x);
        COSEKey.set(-3, y);

        return isoCBOR.encode(COSEKey);
    }

    // Save the credential props to the file
    saveCredentialProps() {
        if (!this.credentialProps) {
            console.error("No credential props to save");
            return;
        }

        const jsonOutput = {
            credentialId: Buffer.from(
                this.credentialProps.credentialId
            ).toString("base64"),
            privateKey: Buffer.from(this.credentialProps.privateKey).toString(
                "base64"
            ),
            aaguid: Buffer.from(this.credentialProps.aaguid).toString("base64"),
        };

        // Save the authenticator state to the file
        writeFileSync(
            this.authenticatorFile,
            JSON.stringify(jsonOutput, null, 2)
        );
    }

    // Restore the credential props from the file
    private restoreCredentialProps() {
        // Check if the file exists
        if (!existsSync(this.authenticatorFile)) {
            console.warn(
                "No authenticator state file found, will probably generate new ones"
            );
            return;
        }

        // Read the file
        const jsonInput = readFileSync(this.authenticatorFile, "utf-8");
        const { credentialId, privateKey, aaguid } = JSON.parse(jsonInput) as {
            credentialId: string;
            privateKey: string;
            aaguid: string;
        };
        const parsedPrivateKey = Buffer.from(privateKey, "base64");
        const publicKey = p256.getPublicKey(parsedPrivateKey, false);
        this.credentialProps = {
            credentialId: Buffer.from(credentialId, "base64"),
            privateKey: parsedPrivateKey,
            aaguid: Buffer.from(aaguid, "base64"),
            publicKey,
            cosePublicKey: this.cosePublicKeyCBOR(publicKey),
        };
    }

    // Generate fresh credential props
    private generateCredentialProp() {
        // Convert to base64 and add platform-specific prefix
        const credentialId = `PLAYWRIGHT_${randomBytes(32).toString("base64")}`;
        const privateKey = p256.utils.randomPrivateKey();
        const publicKey = p256.getPublicKey(privateKey, false);
        // Return the credential properties
        return {
            aaguid: Buffer.from(CHROMIUM_AAGUID.replace(/-/g, ""), "hex"),
            credentialId: Buffer.from(credentialId),
            privateKey,
            publicKey,
            cosePublicKey: this.cosePublicKeyCBOR(publicKey),
        };
    }

    async getSignatureCounter(container?: Page | Frame) {
        return (container ?? this.page).evaluate(
            () => window.frak_mockedWebAuthNCounter
        );
    }

    async verifySignature(container?: Page | Frame) {
        const initial = await this.getSignatureCounter(container);
        const target = (initial ?? 0) + 1;

        await (container ?? this.page).waitForFunction(
            (target) => {
                return (window.frak_mockedWebAuthNCounter || 0) >= target;
            },
            target,
            { timeout: 10_000 }
        );
    }
}
