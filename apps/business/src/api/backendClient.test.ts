import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useTwoFactorStore } from "@/stores/twoFactorStore";
import { parse401, stepUpAwareFetch } from "./backendClient";

function jsonResponse(
    status: number,
    body: unknown,
    headers: Record<string, string> = {}
): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: { "content-type": "application/json", ...headers },
    });
}

/** Assign a vitest mock as the global fetch. The cast drops fetch's static
 * `preconnect` sibling, which these tests never exercise. */
function setGlobalFetch(mock: ReturnType<typeof vi.fn>): void {
    global.fetch = mock as unknown as typeof fetch;
}

/** A step-up 401 in the canonical header-only format: the discriminator +
 * methods live in headers, the body is a plain `ErrorResponse`. */
function stepUpResponse(methods: string[]): Response {
    return jsonResponse(
        401,
        { success: false, code: "STEP_UP_REQUIRED", error: "Step up" },
        {
            "x-frak-auth-error": "step-up-required",
            "x-frak-auth-methods": methods.join(","),
        }
    );
}

describe("stepUpAwareFetch", () => {
    const originalFetch = global.fetch;

    beforeEach(() => {
        useTwoFactorStore.setState({
            request: null,
            pendingLoginMethods: null,
        });
    });

    afterEach(() => {
        global.fetch = originalFetch;
        vi.restoreAllMocks();
    });

    it("passes through non-401 responses untouched", async () => {
        setGlobalFetch(
            vi.fn().mockResolvedValue(jsonResponse(200, { ok: true }))
        );

        const response = await stepUpAwareFetch("https://api.test/x");

        expect(response.status).toBe(200);
        expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it("passes through a plain 401 (not step-up) without opening the modal", async () => {
        setGlobalFetch(
            vi.fn().mockResolvedValue(jsonResponse(401, "Unauthorized"))
        );

        const response = await stepUpAwareFetch("https://api.test/x");

        expect(response.status).toBe(401);
        expect(global.fetch).toHaveBeenCalledTimes(1);
        expect(useTwoFactorStore.getState().request).toBeNull();
    });

    it("ignores a body-only step-up (no header) — headers are the sole signal", async () => {
        // Without the `x-frak-auth-error` header it is not a step-up: the body
        // shape alone must not open the modal (headers are the only signal).
        setGlobalFetch(
            vi.fn().mockResolvedValue(
                jsonResponse(401, {
                    success: false,
                    code: "STEP_UP_REQUIRED",
                    error: "Step up",
                })
            )
        );

        const response = await stepUpAwareFetch("https://api.test/x");

        expect(response.status).toBe(401);
        expect(global.fetch).toHaveBeenCalledTimes(1);
        expect(useTwoFactorStore.getState().request).toBeNull();
    });

    it("opens the 2FA modal and retries once on a step-up 401", async () => {
        const successResponse = jsonResponse(200, { ok: true });

        const fetchMock = vi
            .fn()
            .mockResolvedValueOnce(stepUpResponse(["email", "totp"]))
            .mockResolvedValueOnce(successResponse);
        setGlobalFetch(fetchMock);

        const promise = stepUpAwareFetch("https://api.test/x");

        // Wait a tick for the challenge response to be read and the store
        // to open its request.
        await vi.waitFor(() => {
            expect(useTwoFactorStore.getState().request).not.toBeNull();
        });
        expect(useTwoFactorStore.getState().request?.methods).toEqual([
            "email",
            "totp",
        ]);

        // Simulate the modal completing verification.
        useTwoFactorStore.getState().resolveVerification();

        const response = await promise;

        expect(response.status).toBe(200);
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it("classifies a step-up 401 and reads its methods from the header", async () => {
        const { isStepUp, methods, code } = await parse401(
            stepUpResponse(["email", "totp"])
        );
        expect(isStepUp).toBe(true);
        expect(methods).toEqual(["email", "totp"]);
        expect(code).toBeUndefined();
    });

    it("treats a 2FA validation failure as non-step-up but exposes its code", async () => {
        // A wrong SIWE proof / OTP code is a validation failure: the session
        // is still valid, so the 401 handler must not disconnect — it keys off
        // this typed code to keep the session.
        const { isStepUp, code } = await parse401(
            jsonResponse(401, {
                success: false,
                code: "INVALID_TWO_FACTOR_PROOF",
                error: "Invalid proof",
            })
        );
        expect(isStepUp).toBe(false);
        expect(code).toBe("INVALID_TWO_FACTOR_PROOF");
    });

    it("classifies a genuine dead-session 401 with neither step-up nor code", async () => {
        const { isStepUp, code } = await parse401(
            jsonResponse(401, "Unauthorized")
        );
        expect(isStepUp).toBe(false);
        expect(code).toBeUndefined();
    });

    it("does not retry when the user cancels the 2FA modal", async () => {
        const fetchMock = vi
            .fn()
            .mockResolvedValueOnce(stepUpResponse(["totp"]));
        setGlobalFetch(fetchMock);

        const promise = stepUpAwareFetch("https://api.test/x");

        await vi.waitFor(() => {
            expect(useTwoFactorStore.getState().request).not.toBeNull();
        });

        useTwoFactorStore.getState().cancelVerification();

        const response = await promise;

        expect(response.status).toBe(401);
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });
});
