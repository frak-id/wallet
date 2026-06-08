import {
    base64URLStringToBuffer,
    bufferToBase64URLString,
} from "@frak-labs/wallet-shared/common/utils/base64url";
import { getAddress, type Hex } from "viem";
import { describe, expect, test } from "@/tests/vitest-fixtures";
import { decodeRecoveryBlob, encodeRecoveryBlob } from "./recoveryBlob";

describe("recoveryBlob", () => {
    const smartWalletAddress = getAddress(
        "0x1234567890123456789012345678901234567890"
    );
    const burnerPrivateKey: Hex =
        "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";
    const password = "correct horse battery staple";

    test("round-trips address + burner key", async () => {
        const blob = await encodeRecoveryBlob({
            smartWalletAddress,
            burnerPrivateKey,
            password,
        });

        expect(typeof blob).toBe("string");
        expect(blob).not.toMatch(/[+/=]/);

        const decoded = await decodeRecoveryBlob({ blob, password });
        expect(decoded).toEqual({ smartWalletAddress, burnerPrivateKey });
    });

    test("returns null for a wrong password", async () => {
        const blob = await encodeRecoveryBlob({
            smartWalletAddress,
            burnerPrivateKey,
            password,
        });

        expect(
            await decodeRecoveryBlob({ blob, password: "wrong-password" })
        ).toBeNull();
    });

    test("produces a fresh blob each time (random iv + salt)", async () => {
        const a = await encodeRecoveryBlob({
            smartWalletAddress,
            burnerPrivateKey,
            password,
        });
        const b = await encodeRecoveryBlob({
            smartWalletAddress,
            burnerPrivateKey,
            password,
        });

        expect(a).not.toBe(b);
        expect(await decodeRecoveryBlob({ blob: b, password })).toEqual({
            smartWalletAddress,
            burnerPrivateKey,
        });
    });

    test("returns null when the ciphertext is tampered", async () => {
        const blob = await encodeRecoveryBlob({
            smartWalletAddress,
            burnerPrivateKey,
            password,
        });

        const bytes = new Uint8Array(base64URLStringToBuffer(blob));
        bytes[bytes.length - 1] ^= 0xff;

        expect(
            await decodeRecoveryBlob({
                blob: bufferToBase64URLString(bytes),
                password,
            })
        ).toBeNull();
    });

    test("returns null for an unknown version byte", async () => {
        const blob = await encodeRecoveryBlob({
            smartWalletAddress,
            burnerPrivateKey,
            password,
        });

        const bytes = new Uint8Array(base64URLStringToBuffer(blob));
        bytes[0] = 0x02;

        expect(
            await decodeRecoveryBlob({
                blob: bufferToBase64URLString(bytes),
                password,
            })
        ).toBeNull();
    });

    test("returns null for malformed base64 instead of throwing", async () => {
        expect(
            await decodeRecoveryBlob({ blob: "not-valid-base64-!!!", password })
        ).toBeNull();
    });
});
