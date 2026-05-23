import {
    buildSmartAccount,
    type SmartAccountConnectorClient,
} from "@frak-labs/wallet-shared";
import type { Address, Hex } from "viem";

type BuildLoserBundlerClientArgs = {
    loser: Address;
    loserAuthenticatorId: string;
    loserPublicKey: { x: Hex; y: Hex };
    /**
     * `"local"` — loser passkey is on this device (same-device merge OR
     * cross-device merge where desktop is the loser); signing happens via
     * the local WebAuthn ceremony, identical to the live wagmi session.
     * `"paired"` — loser passkey lives on the peer device; signing routes
     * through the merge's already-live origin pairing client.
     */
    transport: "local" | "paired";
};

/**
 * Build a viem bundler client (kernel smart account + Pimlico transport +
 * paymaster) pinned to the loser wallet, without touching the live wagmi
 * session.
 *
 * Synthesises the wallet shape `buildSmartAccount` expects so we can reuse
 * the same construction path the wagmi connector uses for live sessions.
 * `transports: undefined` matches the canonical shape stored in
 * sessionStore for both webauthn variants — the field exists only on
 * locally-stored sessions and is irrelevant for the merge migration.
 *
 * The `paired` branch piggybacks on the merge's already-open origin
 * pairing (the same one that ferried the consent assertion). The pairing
 * client is a module singleton, so no additional plumbing is needed
 * beyond passing the right `wallet.type`.
 */
export async function buildLoserBundlerClient({
    loser,
    loserAuthenticatorId,
    loserPublicKey,
    transport,
}: BuildLoserBundlerClientArgs): Promise<SmartAccountConnectorClient> {
    if (transport === "paired") {
        return buildSmartAccount({
            wallet: {
                type: "distant-webauthn",
                address: loser,
                authenticatorId: loserAuthenticatorId,
                publicKey: loserPublicKey,
                pairingId: "",
                transports: undefined,
            },
        });
    }
    return buildSmartAccount({
        wallet: {
            type: "webauthn",
            address: loser,
            authenticatorId: loserAuthenticatorId,
            publicKey: loserPublicKey,
            transports: undefined,
        },
    });
}
