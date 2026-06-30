import { JwtContext, sessionContext } from "@backend-infrastructure";
import {
    AUTH_ERROR_HEADER,
    AuthErrorCode,
} from "@backend-infrastructure/macro/authError";
import { Elysia, status } from "elysia";
import { IdentityContext } from "../../../../domain/identity/context";

/**
 * Resolve macro for the post-auth email routes.
 *
 * Verifies the wallet session, rejects ECDSA/distant sessions (which carry no
 * email and are out of scope for these flows) and resolves the caller's
 * identity group — exposing `{ walletSession, walletGroup }` to the handler.
 *
 * Collapses the `ecdsa guard + findGroupByIdentity + 404` block that the
 * associate / verification / verify handlers each repeated. `GET /email`
 * deliberately keeps its own inline handling: it degrades to an empty status
 * (200) for ECDSA / no-group rather than the 400/404 this macro short-circuits.
 */
export const walletGroupContext = new Elysia({ name: "Macro.walletGroup" })
    .use(sessionContext)
    .macro({
        withWalletGroup: {
            async resolve({ headers, set }) {
                const walletAuth = headers["x-wallet-auth"];
                if (!walletAuth) {
                    set.headers[AUTH_ERROR_HEADER] =
                        AuthErrorCode.walletTokenInvalid;
                    return status(401, "Unauthorized");
                }
                const walletSession =
                    await JwtContext.wallet.verify(walletAuth);
                if (!walletSession) {
                    set.headers[AUTH_ERROR_HEADER] =
                        AuthErrorCode.walletTokenInvalid;
                    return status(401, "Unauthorized");
                }
                if (walletSession.type === "ecdsa") {
                    return status(400, "Unsupported wallet type");
                }
                const walletGroup =
                    await IdentityContext.repositories.identity.findGroupByIdentity(
                        { type: "wallet", value: walletSession.address }
                    );
                if (!walletGroup) {
                    return status(404, "Wallet identity not found");
                }
                return { walletSession, walletGroup };
            },
        },
    })
    .as("scoped");
