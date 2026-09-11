import type { Address } from "viem";
import { describe, expect, it } from "vitest";
import { pairingKey } from "./index";

const wallet = "0x1234567890abcdef1234567890abcdef12345678" as Address;

describe("pairingKey", () => {
    it("builds getInfo keys, falling back to an empty id", () => {
        expect(pairingKey.getInfo("pairing-123")).toEqual([
            "pairing",
            "pairing-123",
        ]);
        expect(pairingKey.getInfo()).toEqual(["pairing", ""]);
    });

    it("builds the remove mutation key", () => {
        expect(pairingKey.remove).toEqual(["pairing", "delete"]);
    });

    it("builds listByWallet keys, keeping undefined distinguishable", () => {
        expect(pairingKey.listByWallet(wallet)).toEqual([
            "pairing",
            "list",
            wallet,
        ]);
        expect(pairingKey.listByWallet()).toEqual([
            "pairing",
            "list",
            undefined,
        ]);
    });

    it("builds target signature-request keys", () => {
        expect(pairingKey.target.handleSignatureRequest(wallet)).toEqual([
            "pairing",
            "target",
            "signature-request",
            wallet,
        ]);
        expect(pairingKey.target.handleSignatureRequest()).toEqual([
            "pairing",
            "target",
            "signature-request",
            undefined,
        ]);
    });
});
