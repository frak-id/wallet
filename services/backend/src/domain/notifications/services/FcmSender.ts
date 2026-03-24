import {
    type ClientHttp2Session,
    constants,
    connect as http2Connect,
} from "node:http2";
import { log } from "@backend-infrastructure";
import { importPKCS8, SignJWT } from "jose";
import type { SendNotificationPayload } from "../dto/SendNotificationDto";

const FCM_BATCH_SIZE = 500;
const FCM_HOST = "https://fcm.googleapis.com";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const MESSAGING_SCOPE = "https://www.googleapis.com/auth/firebase.messaging";

/** @see https://github.com/firebase/firebase-admin-node/blob/main/src/messaging/messaging-api-request-internal.ts#L30 */
const STREAM_TIMEOUT_MS = 15_000;

/** @see https://github.com/firebase/firebase-admin-node/blob/main/src/utils/api-request.ts#L244-L252 */
const MAX_RETRIES = 4;
const RETRY_BACKOFF_FACTOR = 0.5;
const MAX_RETRY_DELAY_MS = 60_000;
const RETRYABLE_STATUS_CODES = new Set([503]);
const RETRYABLE_ERROR_CODES = new Set(["ECONNRESET", "ETIMEDOUT"]);

/** @see https://firebase.google.com/docs/cloud-messaging/send-message#error-codes */
const HARD_INVALID_TOKEN_CODES = new Set([
    "UNREGISTERED",
    "SENDER_ID_MISMATCH",
]);

type ServiceAccountConfig = {
    project_id: string;
    client_email: string;
    private_key: string;
};

type FcmErrorResponse = {
    error?: {
        code?: number;
        message?: string;
        status?: string;
        details?: Array<{
            "@type"?: string;
            errorCode?: string;
        }>;
    };
};

type StreamResult =
    | { outcome: "success" }
    | { outcome: "invalid_token"; token: string }
    | { outcome: "retryable"; statusCode?: number; errorCode?: string }
    | { outcome: "non_retryable" };

export class FcmSender {
    private serviceAccount: ServiceAccountConfig | null | undefined;
    private signingKey: CryptoKey | null = null;
    private accessToken: string | null = null;
    private tokenExpiresAt = 0;
    private inflightTokenRefresh: Promise<string> | null = null;

    async send({
        tokens,
        payload,
    }: {
        tokens: string[];
        payload: SendNotificationPayload;
    }): Promise<string[]> {
        const sa = this.getServiceAccount();
        if (!sa) {
            log.warn(
                "[FcmSender] Firebase not configured (FCM_SERVICE_ACCOUNT_JSON missing), skipping FCM send"
            );
            return [];
        }

        const invalidTokens: string[] = [];

        for (let i = 0; i < tokens.length; i += FCM_BATCH_SIZE) {
            const batch = tokens.slice(i, i + FCM_BATCH_SIZE);

            try {
                const invalid = await this.sendBatch(sa, batch, payload);
                invalidTokens.push(...invalid);
            } catch (error) {
                log.warn(
                    { error },
                    `[FcmSender] Batch ${Math.floor(i / FCM_BATCH_SIZE) + 1} failed entirely`
                );
            }
        }

        if (invalidTokens.length > 0) {
            log.info(
                `[FcmSender] Found ${invalidTokens.length} invalid FCM token(s) to clean up`
            );
        }

        return invalidTokens;
    }

    private getServiceAccount(): ServiceAccountConfig | null {
        if (this.serviceAccount !== undefined) return this.serviceAccount;

        const json = process.env.FCM_SERVICE_ACCOUNT_JSON;
        if (!json) {
            this.serviceAccount = null;
            return null;
        }

        try {
            this.serviceAccount = JSON.parse(json) as ServiceAccountConfig;
            return this.serviceAccount;
        } catch {
            log.error(
                "[FcmSender] FCM_SERVICE_ACCOUNT_JSON is not valid JSON, skipping Firebase init"
            );
            this.serviceAccount = null;
            return null;
        }
    }

    /** @see https://github.com/firebase/firebase-admin-node/blob/main/src/app/firebase-app.ts#L40-L123 */
    private async getAccessToken(sa: ServiceAccountConfig): Promise<string> {
        if (this.accessToken && Date.now() < this.tokenExpiresAt) {
            return this.accessToken;
        }

        if (!this.inflightTokenRefresh) {
            this.inflightTokenRefresh = this.refreshAccessToken(sa).finally(
                () => {
                    this.inflightTokenRefresh = null;
                }
            );
        }
        return this.inflightTokenRefresh;
    }

    private async refreshAccessToken(
        sa: ServiceAccountConfig
    ): Promise<string> {
        if (!this.signingKey) {
            this.signingKey = await importPKCS8(sa.private_key, "RS256");
        }

        const jwt = await new SignJWT({ scope: MESSAGING_SCOPE })
            .setProtectedHeader({ alg: "RS256", typ: "JWT" })
            .setIssuer(sa.client_email)
            .setSubject(sa.client_email)
            .setAudience(TOKEN_URL)
            .setIssuedAt()
            .setExpirationTime("1h")
            .sign(this.signingKey);

        const res = await fetch(TOKEN_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({
                grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
                assertion: jwt,
            }),
        });

        if (!res.ok) {
            const text = await res.text();
            throw new Error(
                `[FcmSender] OAuth2 token exchange failed (${res.status}): ${text}`
            );
        }

        const { access_token, expires_in } = (await res.json()) as {
            access_token: string;
            expires_in: number;
        };

        this.accessToken = access_token;
        this.tokenExpiresAt =
            Date.now() + Math.max(expires_in - 300, 30) * 1000;

        return access_token;
    }

    private async sendBatch(
        sa: ServiceAccountConfig,
        tokens: string[],
        payload: SendNotificationPayload
    ): Promise<string[]> {
        const accessToken = await this.getAccessToken(sa);
        const path = `/v1/projects/${sa.project_id}/messages:send`;

        const session = http2Connect(FCM_HOST, {
            peerMaxConcurrentStreams: 100,
            ALPNProtocols: ["h2"],
        });

        session.unref();

        session.on("error", (err) => {
            log.warn({ error: err }, "[FcmSender] HTTP/2 session error");
        });

        session.on(
            "goaway",
            (errorCode: number, _lastStreamId: number, opaqueData: Buffer) => {
                if (errorCode === constants.NGHTTP2_NO_ERROR) {
                    log.debug(
                        "[FcmSender] HTTP/2 GOAWAY NO_ERROR (graceful shutdown)"
                    );
                    return;
                }
                log.warn(
                    {
                        errorCode,
                        data: opaqueData?.toString("utf8"),
                    },
                    "[FcmSender] HTTP/2 GOAWAY error"
                );
            }
        );

        session.on("frameError", (type, code, streamId) => {
            log.warn(
                { frameType: type, code, streamId },
                "[FcmSender] HTTP/2 frame error"
            );
        });

        try {
            const results = await Promise.allSettled(
                tokens.map((token) =>
                    this.sendOneStreamWithRetry(
                        session,
                        path,
                        accessToken,
                        token,
                        payload
                    )
                )
            );

            const invalidTokens: string[] = [];
            for (const result of results) {
                if (result.status === "fulfilled" && result.value) {
                    invalidTokens.push(result.value);
                }
            }
            return invalidTokens;
        } finally {
            if (!session.closed && !session.destroyed) {
                session.close(() => {
                    session.removeAllListeners();
                    if (!session.destroyed) {
                        session.destroy();
                    }
                });
            } else {
                session.removeAllListeners();
            }
        }
    }

    /** @see https://github.com/firebase/firebase-admin-node/blob/main/src/utils/api-request.ts#L244-L252 */
    private async sendOneStreamWithRetry(
        session: ClientHttp2Session,
        path: string,
        accessToken: string,
        token: string,
        payload: SendNotificationPayload
    ): Promise<string | null> {
        for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
            if (attempt > 0) {
                const delay = Math.min(
                    2 ** attempt * RETRY_BACKOFF_FACTOR * 1000,
                    MAX_RETRY_DELAY_MS
                );
                await new Promise((r) => setTimeout(r, delay));

                if (session.closed || session.destroyed) {
                    return null;
                }
            }

            const result = await this.sendOneStream(
                session,
                path,
                accessToken,
                token,
                payload
            );

            switch (result.outcome) {
                case "success":
                    return null;
                case "invalid_token":
                    return result.token;
                case "retryable":
                    if (attempt < MAX_RETRIES) {
                        log.debug(
                            {
                                tokenPrefix: token.slice(0, 8),
                                attempt: attempt + 1,
                                statusCode: result.statusCode,
                                errorCode: result.errorCode,
                            },
                            "[FcmSender] Retrying transient failure"
                        );
                        continue;
                    }
                    log.warn(
                        {
                            tokenPrefix: token.slice(0, 8),
                            maxRetries: MAX_RETRIES,
                        },
                        "[FcmSender] Exhausted retries"
                    );
                    return null;
                case "non_retryable":
                    return null;
            }
        }
        return null;
    }

    private sendOneStream(
        session: ClientHttp2Session,
        path: string,
        accessToken: string,
        token: string,
        payload: SendNotificationPayload
    ): Promise<StreamResult> {
        return new Promise((resolve) => {
            if (session.closed || session.destroyed) {
                resolve({ outcome: "non_retryable" });
                return;
            }

            const body = JSON.stringify({
                message: {
                    token,
                    notification: {
                        title: payload.title,
                        body: payload.body,
                        ...(payload.icon && { image: payload.icon }),
                    },
                    data: payload.data?.url
                        ? { url: payload.data.url }
                        : undefined,
                },
            });

            let finished = false;
            const complete = (result: StreamResult) => {
                if (finished) return;
                finished = true;
                resolve(result);
            };

            let req: ReturnType<ClientHttp2Session["request"]>;
            try {
                req = session.request({
                    ":method": "POST",
                    ":path": path,
                    authorization: `Bearer ${accessToken}`,
                    "content-type": "application/json",
                    "content-length": Buffer.byteLength(body).toString(),
                });
            } catch (err) {
                log.warn(
                    { error: err, tokenPrefix: token.slice(0, 8) },
                    "[FcmSender] Failed to create stream"
                );
                complete({ outcome: "non_retryable" });
                return;
            }

            req.setTimeout(STREAM_TIMEOUT_MS, () => {
                req.destroy();
                complete({
                    outcome: "retryable",
                    errorCode: "ETIMEDOUT",
                });
            });

            let responseData = "";
            req.setEncoding("utf8");
            req.on("data", (chunk: string) => {
                responseData += chunk;
            });
            req.on("end", () => {
                complete(this.processStreamResponse(token, responseData));
            });
            req.on("error", (err: Error) => {
                const code = (err as NodeJS.ErrnoException).code;
                if (code && RETRYABLE_ERROR_CODES.has(code)) {
                    complete({ outcome: "retryable", errorCode: code });
                } else {
                    log.warn(
                        { error: err, tokenPrefix: token.slice(0, 8) },
                        "[FcmSender] Stream error"
                    );
                    complete({ outcome: "non_retryable" });
                }
            });

            req.end(body);
        });
    }

    private processStreamResponse(
        token: string,
        responseData: string
    ): StreamResult {
        if (!responseData) {
            log.warn(
                { tokenPrefix: token.slice(0, 8) },
                "[FcmSender] Empty response body"
            );
            return { outcome: "retryable" };
        }

        try {
            const parsed = JSON.parse(responseData) as FcmErrorResponse;
            if (!parsed.error) return { outcome: "success" };

            if (this.isInvalidTokenError(parsed)) {
                return { outcome: "invalid_token", token };
            }

            const statusCode = parsed.error.code;
            if (statusCode && RETRYABLE_STATUS_CODES.has(statusCode)) {
                return { outcome: "retryable", statusCode };
            }

            log.warn(
                {
                    errorCode: parsed.error.status,
                    errorMessage: parsed.error.message,
                    tokenPrefix: token.slice(0, 8),
                },
                "[FcmSender] Non-fatal send error"
            );
            return { outcome: "non_retryable" };
        } catch {
            log.warn(
                {
                    tokenPrefix: token.slice(0, 8),
                    bodyPreview: responseData.slice(0, 200),
                },
                "[FcmSender] Malformed response body"
            );
            return { outcome: "retryable" };
        }
    }

    /**
     * UNREGISTERED / SENDER_ID_MISMATCH → always invalid token.
     * INVALID_ARGUMENT → only invalid when error message references "registration token"
     * (avoids mass-deleting tokens when the payload itself is malformed).
     * @see https://github.com/eladnava/fcm-v1-http2
     */
    private isInvalidTokenError(body: FcmErrorResponse): boolean {
        const details = body?.error?.details;
        if (!details) return false;

        for (const detail of details) {
            if (!detail.errorCode) continue;

            if (HARD_INVALID_TOKEN_CODES.has(detail.errorCode)) {
                return true;
            }

            if (detail.errorCode === "INVALID_ARGUMENT") {
                const msg = body.error?.message?.toLowerCase() ?? "";
                return (
                    msg.includes("registration token") ||
                    msg.includes("registration-token")
                );
            }
        }
        return false;
    }
}
