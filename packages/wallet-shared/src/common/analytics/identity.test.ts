import type { Address, Hex } from "viem";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Session } from "../../types/Session";

type FakePanel = {
    profileId: string | undefined;
    global: Record<string, unknown>;
    identify: ReturnType<typeof vi.fn>;
    setGlobalProperties: ReturnType<typeof vi.fn>;
};

const { panel } = vi.hoisted(() => {
    const panel: FakePanel = {
        profileId: undefined,
        global: {},
        identify: vi.fn(),
        setGlobalProperties: vi.fn((props: Record<string, unknown>) => {
            panel.global = { ...panel.global, ...props };
        }),
    };
    return { panel };
});

vi.mock("./openpanel", () => ({
    openPanel: panel,
    getPlatformInfo: () => ({ isTauri: false, platform: "web" }),
}));

const INSTALL_KEY = "frak_analytics_install_id";
const WALLET_A = "0x1111111111111111111111111111111111111111" as Address;
const WALLET_B = "0x2222222222222222222222222222222222222222" as Address;

function session(address: Address): Session {
    return {
        type: "webauthn",
        address,
        publicKey: { x: "0xabc" as Hex, y: "0xdef" as Hex },
        authenticatorId: "auth-id",
        token: "token",
    };
}

async function load() {
    vi.resetModules();
    const identity = await import("./identity");
    const { resolveAnonymousId } = await import("./anonymousId");
    const { clientIdStore } = await import("../../stores/clientIdStore");
    const { sessionStore } = await import("../../stores/sessionStore");
    return { ...identity, resolveAnonymousId, clientIdStore, sessionStore };
}

describe("analytics identity", () => {
    beforeEach(() => {
        window.localStorage.clear();
        panel.profileId = undefined;
        panel.global = {};
        panel.identify.mockClear();
        panel.setGlobalProperties.mockClear();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe("install id", () => {
        it("mints an id once and persists it under the storage key", async () => {
            const { resolveAnonymousId } = await load();
            const id = resolveAnonymousId();
            expect(id).toMatch(/.+/);
            expect(resolveAnonymousId()).toBe(id);
            expect(window.localStorage.getItem(INSTALL_KEY)).toBe(id);
        });

        it("reuses the persisted id across page loads", async () => {
            window.localStorage.setItem(INSTALL_KEY, "stored-install");
            const { resolveAnonymousId } = await load();
            expect(resolveAnonymousId()).toBe("stored-install");
        });

        it("stays stable in memory when storage throws", async () => {
            vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
                throw new Error("blocked");
            });
            vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
                throw new Error("blocked");
            });
            const { resolveAnonymousId } = await load();
            const id = resolveAnonymousId();
            expect(id).toMatch(/.+/);
            expect(resolveAnonymousId()).toBe(id);
        });
    });

    describe("wallet surface", () => {
        it("keys the profile on the install id and the device on the SDK id", async () => {
            window.localStorage.setItem(INSTALL_KEY, "install");
            const { startIdentity, clientIdStore } = await load();
            clientIdStore.setState({ clientId: "sdk-client" });
            startIdentity("wallet");
            expect(panel.profileId).toBe("install");
            expect(panel.global.__deviceId).toBe("sdk-client");
        });

        it("keeps the install profile when an SSO id re-keys the device", async () => {
            window.localStorage.setItem(INSTALL_KEY, "install");
            const { startIdentity, clientIdStore } = await load();
            startIdentity("wallet");
            clientIdStore.getState().setClientId("merchant-a");
            clientIdStore.getState().setClientId("merchant-b");
            expect(panel.profileId).toBe("install");
            expect(panel.global.__deviceId).toBe("merchant-b");
        });
    });

    describe("hosted surfaces", () => {
        it("keys profile and device on the clientIdStore id", async () => {
            const { startIdentity, clientIdStore } = await load();
            clientIdStore.setState({ clientId: "sdk-client" });
            startIdentity("listener");
            expect(panel.profileId).toBe("sdk-client");
            expect(panel.global.__deviceId).toBe("sdk-client");
        });

        it("prefers the host id over the clientIdStore id", async () => {
            const { startIdentity, setHostAnonymousId, clientIdStore } =
                await load();
            clientIdStore.setState({ clientId: "sdk-client" });
            startIdentity("wallet_standalone");
            setHostAnonymousId("host-id");
            expect(panel.profileId).toBe("host-id");
            expect(panel.global.__deviceId).toBe("host-id");
        });

        it("ignores an empty host id", async () => {
            const { setHostAnonymousId } = await load();
            setHostAnonymousId(undefined);
            setHostAnonymousId("");
            expect(panel.profileId).toBeUndefined();
        });

        it("re-keys profile and device when the clientIdStore id changes", async () => {
            const { startIdentity, clientIdStore } = await load();
            startIdentity("listener");
            clientIdStore.getState().setClientId("late-client");
            expect(panel.profileId).toBe("late-client");
            expect(panel.global.__deviceId).toBe("late-client");
        });
    });

    describe("wallet sync", () => {
        it("identifies a rehydrated session once at start", async () => {
            const { startIdentity, sessionStore } = await load();
            sessionStore.setState({ session: session(WALLET_A) });
            startIdentity("wallet");
            expect(panel.global.wallet).toBe(WALLET_A);
            expect(panel.identify).toHaveBeenCalledTimes(1);
            expect(panel.identify).toHaveBeenCalledWith({
                profileId: panel.profileId,
                properties: expect.objectContaining({
                    session_type: "webauthn",
                    platform: "web",
                }),
            });
        });

        it("identifies a login exactly once, even when also synced by hand", async () => {
            const { startIdentity, syncWallet, sessionStore } = await load();
            startIdentity("listener");
            sessionStore.getState().setSession(session(WALLET_A));
            syncWallet(session(WALLET_A));
            expect(panel.global.wallet).toBe(WALLET_A);
            expect(panel.identify).toHaveBeenCalledTimes(1);
        });

        it("ignores session store changes that keep the same wallet", async () => {
            const { startIdentity, sessionStore } = await load();
            startIdentity("wallet");
            sessionStore.getState().setSession(session(WALLET_A));
            sessionStore.getState().setSdkSession({ token: "t", expires: 1 });
            expect(panel.identify).toHaveBeenCalledTimes(1);
        });

        it("drops the wallet on logout and keeps the anonymous profile", async () => {
            const { startIdentity, sessionStore } = await load();
            startIdentity("wallet");
            const anon = panel.profileId;
            sessionStore.getState().setSession(session(WALLET_A));
            sessionStore.getState().clearSession();
            expect(panel.global.wallet).toBeUndefined();
            expect(panel.profileId).toBe(anon);
            expect(panel.identify).toHaveBeenCalledTimes(1);
        });

        it("re-identifies the wallet on the new profile when the id is re-keyed", async () => {
            const { startIdentity, sessionStore, clientIdStore } = await load();
            startIdentity("listener");
            sessionStore.getState().setSession(session(WALLET_A));
            clientIdStore.getState().setClientId("sso-client");
            expect(panel.identify).toHaveBeenCalledTimes(2);
            expect(panel.identify).toHaveBeenLastCalledWith({
                profileId: "sso-client",
                properties: {},
            });
        });

        it("does not identify an anonymous re-key", async () => {
            const { startIdentity, clientIdStore } = await load();
            startIdentity("listener");
            clientIdStore.getState().setClientId("late-client");
            expect(panel.identify).not.toHaveBeenCalled();
        });

        it("never makes the wallet address the profile id", async () => {
            const { startIdentity, setHostAnonymousId, sessionStore } =
                await load();
            startIdentity("listener");
            sessionStore.getState().setSession(session(WALLET_A));
            setHostAnonymousId("host-id");
            sessionStore.getState().setSession(session(WALLET_B));
            for (const call of panel.identify.mock.calls) {
                expect(call[0].profileId.startsWith("0x")).toBe(false);
            }
            expect(panel.profileId?.startsWith("0x")).toBe(false);
        });
    });

    describe("profile properties", () => {
        it("buffers properties set before start and flushes them on start", async () => {
            const { startIdentity, setProfileProperties } = await load();
            setProfileProperties({ install_source: "play" });
            expect(panel.identify).not.toHaveBeenCalled();
            startIdentity("wallet");
            expect(panel.identify).toHaveBeenCalledWith({
                profileId: panel.profileId,
                properties: { install_source: "play" },
            });
        });

        it("sends properties straight to the anonymous profile after start", async () => {
            const { startIdentity, setProfileProperties } = await load();
            startIdentity("wallet");
            setProfileProperties({ install_source: "play" });
            expect(panel.identify).toHaveBeenCalledTimes(1);
            expect(panel.identify).toHaveBeenCalledWith({
                profileId: panel.profileId,
                properties: { install_source: "play" },
            });
        });
    });
});
