import type { Address } from "viem";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

vi.mock("./openpanel", () => ({ openPanel: panel }));

const INSTALL_KEY = "frak_analytics_install_id";
const WALLET_A = "0x1111111111111111111111111111111111111111" as Address;
const WALLET_B = "0x2222222222222222222222222222222222222222" as Address;

async function load() {
    vi.resetModules();
    const identity = await import("./identity");
    const { resolveAnonymousId } = await import("./anonymousId");
    const { clientIdStore } = await import("../../stores/clientIdStore");
    return { ...identity, resolveAnonymousId, clientIdStore };
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

    describe("applyIdentity", () => {
        it("pins profile and device to the install id by default", async () => {
            const { applyIdentity, resolveAnonymousId } = await load();
            applyIdentity();
            expect(panel.profileId).toBe(resolveAnonymousId());
            expect(panel.global.__deviceId).toBe(panel.profileId);
        });

        it("prefers the clientIdStore id over the install id", async () => {
            const { applyIdentity, clientIdStore } = await load();
            clientIdStore.setState({ clientId: "sdk-client" });
            applyIdentity();
            expect(panel.profileId).toBe("sdk-client");
            expect(panel.global.__deviceId).toBe("sdk-client");
        });

        it("prefers the host id over the clientIdStore id", async () => {
            const { setHostAnonymousId, clientIdStore } = await load();
            clientIdStore.setState({ clientId: "sdk-client" });
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

        it("re-keys when the clientIdStore id changes, including on setClientId", async () => {
            const { applyIdentity, clientIdStore } = await load();
            applyIdentity();
            clientIdStore.getState().setClientId("late-client");
            expect(panel.profileId).toBe("late-client");
            expect(panel.global.__deviceId).toBe("late-client");
        });
    });

    describe("setWallet", () => {
        it("sets the wallet property and identifies the anonymous profile", async () => {
            const { applyIdentity, setWallet } = await load();
            applyIdentity();
            const anon = panel.profileId;
            setWallet(WALLET_A);
            expect(panel.global.wallet).toBe(WALLET_A);
            expect(panel.identify).toHaveBeenCalledTimes(1);
            expect(panel.identify).toHaveBeenCalledWith({
                profileId: anon,
                properties: undefined,
            });
        });

        it("merges extra profile properties into the same identify call", async () => {
            const { applyIdentity, setWallet } = await load();
            applyIdentity();
            setWallet(WALLET_A, { session_type: "webauthn" });
            expect(panel.identify).toHaveBeenCalledTimes(1);
            expect(panel.identify).toHaveBeenCalledWith(
                expect.objectContaining({
                    properties: { session_type: "webauthn" },
                })
            );
        });

        it("identifies again when the wallet changes, keeping the profile", async () => {
            const { applyIdentity, setWallet } = await load();
            applyIdentity();
            const anon = panel.profileId;
            setWallet(WALLET_A);
            setWallet(WALLET_B);
            expect(panel.identify).toHaveBeenCalledTimes(2);
            expect(panel.identify).toHaveBeenLastCalledWith({
                profileId: anon,
                properties: undefined,
            });
            expect(panel.global.wallet).toBe(WALLET_B);
        });

        it("drops the wallet property on logout and keeps the anonymous id", async () => {
            const { applyIdentity, setWallet } = await load();
            applyIdentity();
            const anon = panel.profileId;
            setWallet(WALLET_A);
            setWallet(undefined);
            expect(panel.global.wallet).toBeUndefined();
            expect(panel.profileId).toBe(anon);
            expect(panel.identify).toHaveBeenCalledTimes(1);
        });

        it("identifies the wallet once the identity is applied, when set earlier", async () => {
            const { applyIdentity, setWallet } = await load();
            setWallet(WALLET_A);
            expect(panel.identify).not.toHaveBeenCalled();
            applyIdentity();
            expect(panel.identify).toHaveBeenCalledWith({
                profileId: panel.profileId,
                properties: undefined,
            });
        });

        it("re-identifies the wallet on the new profile when the id is re-keyed", async () => {
            const { applyIdentity, setWallet, clientIdStore } = await load();
            applyIdentity();
            setWallet(WALLET_A);
            clientIdStore.getState().setClientId("sso-client");
            expect(panel.profileId).toBe("sso-client");
            expect(panel.identify).toHaveBeenLastCalledWith({
                profileId: "sso-client",
                properties: undefined,
            });
        });

        it("never makes the wallet address the profile id", async () => {
            const {
                applyIdentity,
                setWallet,
                setHostAnonymousId,
                clientIdStore,
            } = await load();
            const seen = new Set<string | undefined>();
            const record = () => seen.add(panel.profileId);
            applyIdentity();
            record();
            setWallet(WALLET_A);
            record();
            clientIdStore.getState().setClientId("sdk-client");
            record();
            setHostAnonymousId("host-id");
            record();
            setWallet(WALLET_B);
            record();
            setWallet(undefined);
            record();
            for (const id of seen) expect(id?.startsWith("0x")).toBe(false);
            for (const call of panel.identify.mock.calls) {
                expect(call[0].profileId.startsWith("0x")).toBe(false);
            }
        });
    });
});
