import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useTwoFactorStore } from "@/stores/twoFactorStore";
import { stepUpAwareFetch } from "./backendClient";

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

    it("opens the 2FA modal and retries once on a step-up 401", async () => {
        const stepUpResponse = jsonResponse(
            401,
            { error: "step_up_required", methods: ["email", "totp"] },
            { "x-frak-auth-error": "step-up-required" }
        );
        const successResponse = jsonResponse(200, { ok: true });

        const fetchMock = vi
            .fn()
            .mockResolvedValueOnce(stepUpResponse)
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

    it("does not retry when the user cancels the 2FA modal", async () => {
        const stepUpResponse = jsonResponse(
            401,
            { error: "step_up_required", methods: ["totp"] },
            { "x-frak-auth-error": "step-up-required" }
        );

        const fetchMock = vi.fn().mockResolvedValueOnce(stepUpResponse);
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
