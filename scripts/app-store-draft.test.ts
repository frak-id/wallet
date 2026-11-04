import { describe, expect, it } from "vitest";
import {
    type Client,
    createClient,
    draftVersion,
    notesFor,
    planVersion,
    type Resource,
    signToken,
    type VersionAttributes,
    waitForBuild,
} from "./app-store-draft";

const notes = {
    "en-US": "• Faster sign-in.",
    "fr-FR": "• Connexion plus rapide.",
};
const wait = {
    pollMs: 0,
    timeoutMs: 60_000,
    sleep: async () => {},
    log: () => {},
};

function version(
    id: string,
    versionString: string,
    state: string
): Resource<VersionAttributes> {
    return {
        id,
        type: "appStoreVersions",
        attributes: { versionString, appVersionState: state },
    };
}

async function keyPair(): Promise<{ pem: string; publicKey: CryptoKey }> {
    const pair = await crypto.subtle.generateKey(
        { name: "ECDSA", namedCurve: "P-256" },
        true,
        ["sign", "verify"]
    );
    const der = Buffer.from(
        await crypto.subtle.exportKey("pkcs8", pair.privateKey)
    );
    const body = der.toString("base64").replace(/.{64}/g, "$&\n");
    return {
        pem: `-----BEGIN PRIVATE KEY-----\n${body}\n-----END PRIVATE KEY-----\n`,
        publicKey: pair.publicKey,
    };
}

type Call = { method: string; path: string; body?: unknown };

function fakeConnect(routes: Record<string, (body?: unknown) => unknown>): {
    client: Client;
    calls: Call[];
} {
    const calls: Call[] = [];
    const client = (async (method: string, path: string, body?: unknown) => {
        calls.push({ method, path, body });
        const route = Object.keys(routes).find((key) =>
            `${method} ${path}`.startsWith(key)
        );
        if (!route) throw new Error(`unexpected ${method} ${path}`);
        return routes[route]?.(body) ?? {};
    }) as Client;
    return { client, calls };
}

describe("signToken", () => {
    it("signs an ES256 token App Store Connect can verify", async () => {
        const { pem, publicKey } = await keyPair();
        const token = await signToken(
            { keyId: "KEY123", issuerId: "issuer-uuid", privateKey: pem },
            1_700_000_000_000
        );
        const [header = "", payload = "", signature = ""] = token.split(".");
        const decode = (part: string) =>
            JSON.parse(Buffer.from(part, "base64url").toString());

        expect(decode(header)).toEqual({
            alg: "ES256",
            kid: "KEY123",
            typ: "JWT",
        });
        expect(decode(payload)).toEqual({
            iss: "issuer-uuid",
            iat: 1_700_000_000,
            exp: 1_700_000_900,
            aud: "appstoreconnect-v1",
        });
        const valid = await crypto.subtle.verify(
            { name: "ECDSA", hash: "SHA-256" },
            publicKey,
            Buffer.from(signature, "base64url"),
            new TextEncoder().encode(`${header}.${payload}`)
        );
        expect(valid).toBe(true);
    });
});

describe("createClient", () => {
    it("retries a 5xx and surfaces a 4xx with Apple's error body", async () => {
        const { pem } = await keyPair();
        const responses = [
            new Response("busy", { status: 503 }),
            new Response(JSON.stringify({ data: [] }), { status: 200 }),
            new Response('{"errors":[{"code":"ENTITY_ERROR"}]}', {
                status: 409,
            }),
        ];
        const fetchImpl = (async () =>
            responses.shift()) as unknown as typeof fetch;
        const client = createClient(
            { keyId: "K", issuerId: "I", privateKey: pem },
            fetchImpl,
            0
        );

        await expect(client("GET", "/v1/apps")).resolves.toEqual({ data: [] });
        await expect(client("PATCH", "/v1/apps/1")).rejects.toThrow(
            /HTTP 409[\s\S]*ENTITY_ERROR/
        );
    });
});

describe("planVersion", () => {
    it("creates a version when none is open", () => {
        expect(planVersion([], "1.1.14")).toEqual({ action: "create" });
    });

    it("reuses an unsubmitted draft and renames it to the release", () => {
        expect(
            planVersion(
                [version("v1", "1.1.13", "PREPARE_FOR_SUBMISSION")],
                "1.1.14"
            )
        ).toEqual({
            action: "reuse",
            id: "v1",
            rename: true,
        });
    });

    it("reuses a rejected version as is when it already carries the release", () => {
        expect(
            planVersion([version("v1", "1.1.14", "REJECTED")], "1.1.14")
        ).toEqual({
            action: "reuse",
            id: "v1",
            rename: false,
        });
    });

    it("refuses while Apple holds another version", () => {
        expect(() =>
            planVersion(
                [version("v1", "1.1.13", "WAITING_FOR_REVIEW")],
                "1.1.14"
            )
        ).toThrow("1.1.13 is WAITING_FOR_REVIEW on the App Store");
    });

    it("ignores the live version", () => {
        expect(
            planVersion(
                [version("v0", "1.1.12", "READY_FOR_DISTRIBUTION")],
                "1.1.14"
            )
        ).toEqual({
            action: "create",
        });
    });
});

describe("notesFor", () => {
    it.each([
        ["en-US", notes["en-US"]],
        ["fr-FR", notes["fr-FR"]],
        ["fr-CA", notes["fr-FR"]],
        ["en-GB", notes["en-US"]],
        ["de-DE", notes["en-US"]],
    ])("%s", (locale, expected) => {
        expect(notesFor(locale, notes)).toBe(expected);
    });
});

describe("waitForBuild", () => {
    it("polls until the build is processed", async () => {
        const states = [
            [],
            [{ id: "b1", attributes: { processingState: "PROCESSING" } }],
        ];
        const { client, calls } = fakeConnect({
            "GET /v1/builds": () => ({
                data: states.shift() ?? [
                    { id: "b1", attributes: { processingState: "VALID" } },
                ],
            }),
        });

        await expect(
            waitForBuild(
                client,
                { appId: "app", version: "1.1.14", build: "1.1.14" },
                wait
            )
        ).resolves.toBe("b1");
        expect(calls).toHaveLength(3);
        expect(decodeURIComponent(calls[0]?.path ?? "")).toContain(
            "filter[preReleaseVersion.version]=1.1.14"
        );
    });

    it("fails on a build Apple rejected", async () => {
        const { client } = fakeConnect({
            "GET /v1/builds": () => ({
                data: [
                    { id: "b1", attributes: { processingState: "INVALID" } },
                ],
            }),
        });

        await expect(
            waitForBuild(
                client,
                { appId: "app", version: "1.1.14", build: "1.1.14" },
                wait
            )
        ).rejects.toThrow("is INVALID");
    });
});

describe("draftVersion", () => {
    it("creates the version, attaches the build and writes every localization", async () => {
        const { client, calls } = fakeConnect({
            "GET /v1/apps?": () => ({
                data: [
                    {
                        id: "dev",
                        attributes: { bundleId: "id.frak.wallet.dev" },
                    },
                    { id: "app", attributes: { bundleId: "id.frak.wallet" } },
                ],
            }),
            "GET /v1/builds": () => ({
                data: [{ id: "b1", attributes: { processingState: "VALID" } }],
            }),
            "GET /v1/apps/app/appStoreVersions": () => ({ data: [] }),
            "POST /v1/appStoreVersions": () => ({ data: { id: "v2" } }),
            "PATCH /v1/appStoreVersions/v2/relationships/build": () => ({}),
            "GET /v1/appStoreVersions/v2/appStoreVersionLocalizations": () => ({
                data: [
                    { id: "l1", attributes: { locale: "fr-FR" } },
                    { id: "l2", attributes: { locale: "en-GB" } },
                ],
            }),
            "PATCH /v1/appStoreVersionLocalizations/": () => ({}),
        });

        const result = await draftVersion(
            client,
            {
                bundleId: "id.frak.wallet",
                version: "1.1.14",
                build: "1.1.14",
                notes,
            },
            wait
        );

        expect(result).toEqual({
            appId: "app",
            versionId: "v2",
            locales: ["fr-FR", "en-GB"],
        });
        const writes = calls
            .filter((c) => c.method !== "GET")
            .map((c) => [c.method, c.path, c.body]);
        expect(writes).toEqual([
            [
                "POST",
                "/v1/appStoreVersions",
                {
                    data: {
                        type: "appStoreVersions",
                        attributes: {
                            platform: "IOS",
                            versionString: "1.1.14",
                        },
                        relationships: {
                            app: { data: { type: "apps", id: "app" } },
                        },
                    },
                },
            ],
            [
                "PATCH",
                "/v1/appStoreVersions/v2/relationships/build",
                { data: { type: "builds", id: "b1" } },
            ],
            [
                "PATCH",
                "/v1/appStoreVersionLocalizations/l1",
                {
                    data: {
                        type: "appStoreVersionLocalizations",
                        id: "l1",
                        attributes: { whatsNew: notes["fr-FR"] },
                    },
                },
            ],
            [
                "PATCH",
                "/v1/appStoreVersionLocalizations/l2",
                {
                    data: {
                        type: "appStoreVersionLocalizations",
                        id: "l2",
                        attributes: { whatsNew: notes["en-US"] },
                    },
                },
            ],
        ]);
    });

    it("renames a leftover draft instead of opening a second version", async () => {
        const { client, calls } = fakeConnect({
            "GET /v1/apps?": () => ({
                data: [
                    { id: "app", attributes: { bundleId: "id.frak.wallet" } },
                ],
            }),
            "GET /v1/builds": () => ({
                data: [{ id: "b1", attributes: { processingState: "VALID" } }],
            }),
            "GET /v1/apps/app/appStoreVersions": () => ({
                data: [version("v1", "1.1.13", "PREPARE_FOR_SUBMISSION")],
            }),
            "PATCH /v1/appStoreVersions/v1": () => ({}),
            "GET /v1/appStoreVersions/v1/appStoreVersionLocalizations": () => ({
                data: [],
            }),
        });

        await draftVersion(
            client,
            {
                bundleId: "id.frak.wallet",
                version: "1.1.14",
                build: "1.1.14",
                notes,
            },
            wait
        );

        expect(calls.filter((c) => c.method === "POST")).toEqual([]);
        expect(
            calls.find((c) => c.path === "/v1/appStoreVersions/v1")?.body
        ).toEqual({
            data: {
                type: "appStoreVersions",
                id: "v1",
                attributes: { versionString: "1.1.14" },
            },
        });
    });
});
