import { HttpError } from "@backend-utils";
import { BusinessAuthContext } from "../../../domain/business-auth";
import type { FrakMerchantOwner } from "../../../orchestration/internal";
import type { ResolvedBusinessAuth } from "../middleware/resolveBusinessAuth";

/** How a draw review records the admin: their email, else their wallet. */
export async function actorOf(
    session: ResolvedBusinessAuth | null
): Promise<string> {
    const account = session?.accountId
        ? await BusinessAuthContext.repositories.account.findById(
              session.accountId
          )
        : null;
    return (
        account?.email ?? session?.wallet ?? session?.accountId ?? "dashboard"
    );
}

export function ownerOf(
    session: ResolvedBusinessAuth | null
): FrakMerchantOwner {
    if (session?.wallet) return { wallet: session.wallet };
    if (session?.accountId) return { accountId: session.accountId };
    throw HttpError.badRequest("OWNER_REQUIRED", "Give the merchant an owner");
}
