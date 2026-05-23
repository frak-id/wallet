import {
    buildSmartAccount,
    type SmartAccountConnectorClient,
} from "@frak-labs/wallet-shared";
import type { Address, Hex } from "viem";

type BuildMergeBundlerClientArgs = {
    /** Smart wallet address whose smart account we're synthesising. */
    address: Address;
    /** Credential id of the passkey that signs for this wallet. */
    authenticatorId: string;
    /** Passkey pubkey, as taken from the merge preview. */
    publicKey: { x: Hex; y: Hex };
    /**
     * `"local"` — passkey lives on this device; signing happens via the
     * local WebAuthn ceremony, identical to a live wagmi session.
     * `"paired"` — passkey lives on the peer device; signing routes through
     * the merge's already-live origin pairing client.
     */
    transport: "local" | "paired";
};

/**
 * Build a viem bundler client (kernel smart account + Pimlico transport +
 * paymaster) pinned to an arbitrary smart wallet identity, without
 * touching the live wagmi session.
 *
 * Used by the merge flow to sign as both the loser (asset migration) and
 * the winner (addPassKey) without forcing a session swap. Synthesises the
 * wallet shape `buildSmartAccount` expects so we can reuse the same
 * construction path the wagmi connector uses for live sessions.
 *
 * `transports: undefined` matches the canonical shape stored in
 * sessionStore for both webauthn variants — the field exists only on
 * locally-stored sessions and is irrelevant for ad-hoc merge signing.
 *
 * The `paired` branch piggybacks on the merge's already-open origin
 * pairing (the same one that ferried the consent assertion). The pairing
 * client is a module singleton, so no additional plumbing is needed
 * beyond passing the right `wallet.type`.
 */
export async function buildMergeBundlerClient({
    address,
    authenticatorId,
    publicKey,
    transport,
}: BuildMergeBundlerClientArgs): Promise<SmartAccountConnectorClient> {
    if (transport === "paired") {
        return buildSmartAccount({
            wallet: {
                type: "distant-webauthn",
                address,
                authenticatorId,
                publicKey,
                pairingId: "",
                transports: undefined,
            },
        });
    }
    return buildSmartAccount({
        wallet: {
            type: "webauthn",
            address,
            authenticatorId,
            publicKey,
            transports: undefined,
        },
    });
}
