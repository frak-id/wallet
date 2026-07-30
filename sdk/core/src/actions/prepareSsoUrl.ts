import { getClientId, getClientIdAsync } from "../config/clientId";
import { sdkConfigStore } from "../config/sdkConfigStore";
import { signProof } from "../identity/sign";
import type {
    FrakClient,
    PrepareSsoParamsType,
    PrepareSsoReturnType,
} from "../types";
import { generateSsoUrl } from "../utils/sso/sso";

/**
 * Apply the popup-flow default for `directExit`.
 *
 * Without a `redirectUrl` the popup has nowhere to send the user, so it must
 * close itself — otherwise it sticks on the success screen and its
 * "Redirect now" button is a no-op.
 */
export function withDirectExitDefault<T extends PrepareSsoParamsType>(
    args: T
): T {
    return { ...args, directExit: args.directExit ?? !args.redirectUrl };
}

/**
 * Build the SSO popup URL without opening it.
 *
 * Everything {@link openSso} does before `window.open`, and nothing else:
 * resolves the client and merchant ids, mints the `frak-sso-v1`
 * proof-of-possession, and compresses the whole lot into the URL.
 *
 * Call this ahead of the user's gesture — on mount, on hover, on focus — and
 * hand the result to `openSso(client, { ssoUrl })`, which then opens the popup
 * in the same tick as the click. That is the only way to reliably dodge popup
 * blockers, since `openSso`'s all-in-one form has to await id resolution and
 * proof signing first.
 *
 * @param client - The current Frak Client
 * @param args - The SSO parameters
 * @returns Object containing the generated `ssoUrl`
 *
 * @example
 * ```tsx
 * // Prepared ahead of time, so the click handler stays synchronous
 * const { data } = useQuery({
 *     queryKey: ["sso-url"],
 *     queryFn: () => prepareSsoUrl(client, { metadata }),
 * });
 *
 * <button onClick={() => data && openSso(client, { ssoUrl: data.ssoUrl })}>
 *     Login
 * </button>
 * ```
 *
 * @remarks
 * The proof is minted at prepare time and carries a 10-minute validity window.
 * A URL prepared and left unused for longer still opens SSO and still logs the
 * user in — only the anonymous-to-wallet identity link is dropped. Re-prepare
 * on a long-lived page rather than holding one URL indefinitely.
 *
 * Not to be confused with {@link prepareSso}, which asks the wallet iframe to
 * build the URL over RPC and cannot mint a proof.
 */
export async function prepareSsoUrl(
    client: FrakClient,
    args: PrepareSsoParamsType
): Promise<PrepareSsoReturnType> {
    const { metadata, customizations, walletUrl } = client.config;

    // `getClientIdAsync` REJECTS when no provable id can be produced (no
    // WebCrypto, no localStorage — e.g. Safari with all cookies blocked).
    // SSO must still open in that case, minus the identity link, so this
    // degrades like every other action rather than propagating.
    const clientId =
        getClientId() ?? (await getClientIdAsync().catch(() => undefined));
    const merchantId = (await sdkConfigStore.resolveMerchantId()) ?? "";

    // Proof of possession for clientId, when a key exists. Never blocks or
    // throws SSO on failure (see signProof docs) — legacy pre-derivation
    // clients have no key and simply proceed without a proof.
    const proof =
        clientId && merchantId
            ? await signProof({
                  op: "frak-sso-v1",
                  merchantId,
                  anonymousId: clientId,
              })
            : null;

    return {
        ssoUrl: generateSsoUrl(
            walletUrl ?? "https://wallet.frak.id",
            withDirectExitDefault(args),
            merchantId,
            metadata.name,
            clientId,
            customizations?.css,
            proof ?? undefined
        ),
    };
}
