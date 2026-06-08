import { t } from "@backend-utils";
import { Elysia, status } from "elysia";
import { WalletAuthResponseDto } from "../../../../domain/auth";
import { OrchestrationContext } from "../../../../orchestration/context";
import { FrakClientIdHeaderSchema } from "../../../schemas";

/**
 * Recovery passkey claim — called by the wallet-recovery flow AFTER the new
 * passkey has been added to the recovered wallet on-chain (`doAddPasskey`).
 *
 * Distinct from `/auth/register`, which derives the wallet from the new
 * credential (correct for a brand-new user, wrong for recovery — it would
 * mint a session for the passkey's own empty wallet and fork the identity
 * graph). Here the wallet is supplied by the client and authorized by an
 * on-chain readback: the binding + session are only granted once the
 * validator confirms the passkey really controls that wallet.
 */
export const recoverRoutes = new Elysia()
    .guard({
        headers: FrakClientIdHeaderSchema,
    })
    .post(
        "/recover",
        async ({
            headers,
            body: { id, publicKey, raw, userAgent, wallet },
        }) => {
            const result =
                await OrchestrationContext.orchestrators.recoveryClaim.claimRecoveredWallet(
                    {
                        id,
                        publicKey,
                        raw,
                        userAgent,
                        recoveredWallet: wallet,
                        clientId: headers["x-frak-client-id"],
                    }
                );

            if (result.status === "notAuthorized") {
                return status(
                    400,
                    "Passkey is not registered on this wallet on-chain"
                );
            }
            if (result.status === "conflict") {
                return status(409, "Credential id conflict");
            }

            return result.session;
        },
        {
            body: t.Object({
                id: t.String(),
                publicKey: t.Object({
                    x: t.Hex(),
                    y: t.Hex(),
                    prefix: t.Number(),
                }),
                raw: t.String(),
                userAgent: t.String(),
                /** The wallet the user recovered (decrypted from their blob). */
                wallet: t.Address(),
            }),
            response: {
                400: t.String(),
                409: t.String(),
                200: WalletAuthResponseDto,
            },
        }
    );
