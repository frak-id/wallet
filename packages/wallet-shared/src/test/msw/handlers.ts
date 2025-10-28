import { HttpResponse, http } from "msw";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:3030";

/**
 * MSW request handlers for wallet backend API
 * Mocks API responses for testing
 */
export const handlers = [
    // Balance endpoints
    http.get(`${BACKEND_URL}/wallet/balance`, () => {
        return HttpResponse.json({
            balance: "1000000000000000000",
            formatted: "1.0",
        });
    }),

    http.get(`${BACKEND_URL}/wallet/balance/pending`, () => {
        return HttpResponse.json({
            pending: "500000000000000000",
            formatted: "0.5",
        });
    }),

    // SDK auth endpoints
    http.post(`${BACKEND_URL}/wallet/auth/sdk/fromWebAuthNSignature`, () => {
        return HttpResponse.json({
            token: "sdk-session-token",
            expires: Date.now() + 3600000,
        });
    }),

    http.get(`${BACKEND_URL}/wallet/auth/sdk/isValid`, ({ request }) => {
        const url = new URL(request.url);
        const token = url.searchParams.get("token");

        if (!token || token === "invalid-token") {
            return HttpResponse.json({ valid: false });
        }

        return HttpResponse.json({ valid: true });
    }),

    http.get(`${BACKEND_URL}/wallet/auth/sdk/generate`, () => {
        return HttpResponse.json({
            token: "new-sdk-token",
            expires: Date.now() + 3600000,
        });
    }),

    // Interaction endpoints
    http.post(
        `${BACKEND_URL}/wallet/interactions/push`,
        async ({ request }) => {
            const body = (await request.json()) as { interactions?: unknown[] };
            const interactions = body.interactions || [];

            return HttpResponse.json(
                interactions.map(
                    (_: unknown, index: number) => `delegation-id-${index}`
                )
            );
        }
    ),

    // Pairing endpoints
    http.get(`${BACKEND_URL}/wallet/pairings/list`, () => {
        return HttpResponse.json([
            {
                pairingId: "pairing-1",
                originName: "Device 1",
                targetName: "Wallet",
                createdAt: new Date(Date.now() - 86400000),
                lastActiveAt: new Date(),
            },
            {
                pairingId: "pairing-2",
                originName: "Device 2",
                targetName: "Wallet",
                createdAt: new Date(Date.now() - 172800000),
                lastActiveAt: new Date(),
            },
        ]);
    }),

    http.get(`${BACKEND_URL}/wallet/pairings/:id`, ({ params }) => {
        const { id } = params;

        if (id === "not-found") {
            return new HttpResponse(null, { status: 404 });
        }

        return HttpResponse.json({
            id,
            name: `Device ${id}`,
            createdAt: Date.now() - 86400000,
            publicKey: "0x1234567890abcdef",
        });
    }),

    http.get(`${BACKEND_URL}/wallet/pairings/find`, ({ request }) => {
        const url = new URL(request.url);
        const id = url.searchParams.get("id");

        if (!id || id === "not-found") {
            return new HttpResponse(null, { status: 404 });
        }

        return HttpResponse.json({
            id,
            name: `Device ${id}`,
            createdAt: Date.now() - 86400000,
            publicKey: "0x1234567890abcdef",
        });
    }),

    http.post(`${BACKEND_URL}/wallet/pairings/:id/delete`, ({ params }) => {
        const { id } = params;

        if (id === "not-found") {
            return new HttpResponse(null, { status: 404 });
        }

        return HttpResponse.json({ success: true });
    }),

    // Wallet auth endpoints
    http.post(`${BACKEND_URL}/wallet/auth/login`, async ({ request }) => {
        const body = (await request.json()) as {
            signature?: unknown;
            challenge?: unknown;
        };

        if (!body.signature || !body.challenge) {
            return new HttpResponse(null, { status: 400 });
        }

        return HttpResponse.json({
            token: "auth-token-12345",
            address: "0x1234567890123456789012345678901234567890",
            publicKey: "0xabcdef",
            authenticatorId: "auth-id-123",
        });
    }),

    // Default 404 handler
    http.all(`${BACKEND_URL}/*`, () => {
        return new HttpResponse(null, { status: 404 });
    }),
];
