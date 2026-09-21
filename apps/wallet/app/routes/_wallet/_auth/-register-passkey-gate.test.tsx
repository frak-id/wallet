/** @jsxImportSource react */
// `vi` comes from "vitest" directly: `vi.mock` hoists above module imports,
// so the fixtures module would be an uninitialized binding here.
import { vi } from "vitest";
import { beforeEach, describe, expect, test } from "@/tests/vitest-fixtures";

type StoredAuthenticator = { authenticatorId: string; address: string };

const mocks = vi.hoisted(() => ({
    lastAuthenticator: null as {
        authenticatorId: string;
        address: string;
    } | null,
    storedAuthenticators: [] as StoredAuthenticator[],
    recoveryHint: {} as { lastAuthenticatorId?: string; lastWallet?: string },
    getPasskeyPresence: vi.fn(async () => "unknown" as string),
}));

// `createFileRoute` is mocked so `Route.options.beforeLoad` is reachable
// without standing up a `RouterProvider`. `redirect` stays real so the gate
// throws what the router would actually receive.
vi.mock("@tanstack/react-router", async (importOriginal) => {
    const actual =
        await importOriginal<typeof import("@tanstack/react-router")>();
    return {
        ...actual,
        useNavigate: () => vi.fn(),
        createFileRoute: () => (options: Record<string, unknown>) => ({
            options,
            useSearch: () => ({}),
        }),
    };
});

vi.mock("@frak-labs/wallet-shared", async (importOriginal) => {
    const actual =
        await importOriginal<typeof import("@frak-labs/wallet-shared")>();
    return {
        ...actual,
        authenticationStore: {
            getState: () => ({ lastAuthenticator: mocks.lastAuthenticator }),
        },
        authenticatorStorage: {
            getAll: async () => mocks.storedAuthenticators,
        },
        recoveryHintStorage: { get: async () => mocks.recoveryHint },
        getPasskeyPresence: mocks.getPasskeyPresence,
    };
});

vi.mock("react-i18next", () => ({
    useTranslation: () => ({ t: (key: string) => key }),
    Trans: ({ i18nKey }: { i18nKey: string }) => i18nKey,
}));

import { Route } from "./register";

type ThrownRedirect = { to?: string; options?: { to?: string } };

function redirectTarget(thrown: unknown): string | undefined {
    const asRedirect = thrown as ThrownRedirect;
    return asRedirect?.to ?? asRedirect?.options?.to;
}

async function runGate(search: { new?: boolean } = {}): Promise<unknown> {
    const beforeLoad = Route.options.beforeLoad as (ctx: {
        search: { new?: boolean };
    }) => Promise<void>;
    try {
        await beforeLoad({ search });
        return null;
    } catch (thrown) {
        return thrown;
    }
}

beforeEach(() => {
    vi.clearAllMocks();
    mocks.lastAuthenticator = null;
    mocks.storedAuthenticators = [];
    mocks.recoveryHint = {};
    mocks.getPasskeyPresence.mockResolvedValue("unknown");
});

describe("register passkey gate", () => {
    test("an explicit new-account request never queries the OS", async () => {
        expect(await runGate({ new: true })).toBeNull();
        expect(mocks.getPasskeyPresence).not.toHaveBeenCalled();
    });

    test("a local authenticator record short-circuits ahead of the query", async () => {
        mocks.lastAuthenticator = {
            authenticatorId: "auth-1",
            address: "0xabc",
        };

        expect(redirectTarget(await runGate())).toBe("/login");
        expect(mocks.getPasskeyPresence).not.toHaveBeenCalled();
    });

    test("stored authenticators short-circuit ahead of the query", async () => {
        mocks.storedAuthenticators = [
            { authenticatorId: "auth-1", address: "0xabc" },
        ];

        expect(redirectTarget(await runGate())).toBe("/login");
        expect(mocks.getPasskeyPresence).not.toHaveBeenCalled();
    });

    test("a recovery hint short-circuits ahead of the query", async () => {
        mocks.recoveryHint = {
            lastAuthenticatorId: "auth-1",
            lastWallet: "0xabc",
        };

        expect(redirectTarget(await runGate())).toBe("/login");
        expect(mocks.getPasskeyPresence).not.toHaveBeenCalled();
    });

    test("all three signals missing and a present answer redirects to login", async () => {
        mocks.getPasskeyPresence.mockResolvedValue("present");

        expect(redirectTarget(await runGate())).toBe("/login");
        expect(mocks.getPasskeyPresence).toHaveBeenCalledTimes(1);
    });

    test("an absent answer keeps the user on registration", async () => {
        mocks.getPasskeyPresence.mockResolvedValue("absent");

        expect(await runGate()).toBeNull();
    });

    test("an unknown answer keeps the user on registration", async () => {
        mocks.getPasskeyPresence.mockResolvedValue("unknown");

        expect(await runGate()).toBeNull();
    });

    test("a slow query is awaited and still lands on registration", async () => {
        // The bridge's own timeout resolves `unknown` rather than hanging, so
        // the gate must await the answer instead of reading a pending promise.
        mocks.getPasskeyPresence.mockImplementation(
            () =>
                new Promise((resolve) =>
                    setTimeout(() => resolve("unknown"), 5)
                )
        );

        expect(await runGate()).toBeNull();
        expect(mocks.getPasskeyPresence).toHaveBeenCalledTimes(1);
    });
});
