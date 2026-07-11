import { t } from "@backend-utils";
import { Elysia, status } from "elysia";
import type { Address } from "viem";
import { BusinessAuthContext } from "../../../domain/business-auth";
import { MerchantContext } from "../../../domain/merchant";
import { MerchantIdParamSchema } from "../../schemas";
import {
    businessSessionContext,
    StepUpRequired401,
} from "../middleware/session";

/** One team row — an owner or admin, identified by wallet and/or account. */
const AdminDto = t.Object({
    id: t.String(),
    // Null for walletless identities (business-account owners/admins).
    wallet: t.Union([t.Hex(), t.Null()]),
    accountId: t.Union([t.String(), t.Null()]),
    // Human-readable label for a walletless member (its account email).
    email: t.Union([t.String(), t.Null()]),
    addedBy: t.Union([t.Hex(), t.Null()]),
    addedAt: t.String(),
    isOwner: t.Boolean(),
});

/**
 * Email label for a walletless member (cross-domain composition kept in the
 * BFF layer, consistent with the rest of this branch — the merchant domain
 * never reaches into business-auth).
 */
async function emailForAccount(
    accountId: string | null
): Promise<string | null> {
    if (!accountId) return null;
    const account =
        await BusinessAuthContext.repositories.account.findById(accountId);
    return account?.email ?? null;
}

export const merchantAdminsRoutes = new Elysia({
    prefix: "/:merchantId/admins",
})
    .use(businessSessionContext)
    .get(
        "",
        async ({
            params: { merchantId },
            businessSession,
            shopifySession,
            hasMerchantAccess,
        }) => {
            if (!businessSession && !shopifySession) {
                return status(401, "Authentication required");
            }

            const hasAccess = await hasMerchantAccess(merchantId);
            if (!hasAccess) {
                return status(403, "Access denied");
            }

            const [merchant, admins] = await Promise.all([
                MerchantContext.repositories.merchant.findById(merchantId),
                MerchantContext.repositories.merchantAdmin.findByMerchant(
                    merchantId
                ),
            ]);

            if (!merchant) {
                return status(404, "Merchant not found");
            }

            const ownerRow = {
                id: merchant.id,
                // Walletless owner — wallet is null, identity is the
                // business account (surfaced via `accountId`/`email`).
                wallet: merchant.ownerWallet,
                accountId: merchant.ownerAccountId,
                email: await emailForAccount(merchant.ownerAccountId),
                addedBy: merchant.ownerWallet,
                addedAt: (merchant.createdAt ?? new Date()).toISOString(),
                isOwner: true,
            };

            const adminRows = await Promise.all(
                admins.map(async (admin) => ({
                    id: admin.id,
                    wallet: admin.wallet,
                    accountId: admin.accountId,
                    email: await emailForAccount(admin.accountId),
                    addedBy: admin.addedBy,
                    addedAt: admin.addedAt.toISOString(),
                    isOwner: false,
                }))
            );

            return { admins: [ownerRow, ...adminRows] };
        },
        {
            params: MerchantIdParamSchema,
            response: {
                200: t.Object({ admins: t.Array(AdminDto) }),
                401: t.String(),
                403: t.String(),
                404: t.String(),
            },
        }
    )
    .post(
        "",
        async ({ params: { merchantId }, body, businessSession }) => {
            if (!businessSession) {
                return status(401, "Authentication required");
            }

            const hasAccess =
                await MerchantContext.services.authorization.hasAccess(
                    merchantId,
                    businessSession
                );
            if (!hasAccess) {
                return status(403, "Access denied");
            }

            // Add by wallet, or resolve an email to a walletless account
            // (§2.7). Email resolution is cross-domain composition — it stays
            // here in the BFF layer, never inside the merchant domain.
            let identity: { wallet: Address } | { accountId: string };
            if ("wallet" in body) {
                identity = { wallet: body.wallet };
            } else {
                const account =
                    await BusinessAuthContext.repositories.account.findByEmail(
                        body.email.trim().toLowerCase()
                    );
                if (!account) {
                    return status(404, "No account found for this email");
                }
                identity = { accountId: account.id };
            }

            // `addedBy` records whichever identity the actor holds — wallet
            // for wallet sessions, business account for walletless ones.
            const admin = await MerchantContext.repositories.merchantAdmin.add({
                merchantId,
                identity,
                addedBy: businessSession.wallet,
                addedByAccountId: businessSession.accountId,
            });

            return {
                id: admin.id,
                wallet: admin.wallet,
                accountId: admin.accountId,
                email: await emailForAccount(admin.accountId),
                addedBy: admin.addedBy,
                addedAt: admin.addedAt.toISOString(),
                isOwner: false,
            };
        },
        {
            // Admin management is a sensitive action (§4.8).
            requireStepUp: true,
            params: MerchantIdParamSchema,
            body: t.Union([
                t.Object({ wallet: t.Hex() }),
                t.Object({ email: t.String({ format: "email" }) }),
            ]),
            response: {
                200: AdminDto,
                401: StepUpRequired401,
                403: t.String(),
                404: t.String(),
            },
        }
    )
    .delete(
        "/:adminId",
        async ({
            params: { merchantId, adminId },
            businessSession,
            shopifySession,
            hasMerchantAccess,
        }) => {
            if (!businessSession && !shopifySession) {
                return status(401, "Authentication required");
            }

            const hasAccess = await hasMerchantAccess(merchantId);
            if (!hasAccess) {
                return status(403, "Access denied");
            }

            // Row-id keyed so account-only admins are removable too (§2.7);
            // scoped to `merchantId`, so a foreign id resolves to a 404.
            const removed =
                await MerchantContext.repositories.merchantAdmin.removeById(
                    merchantId,
                    adminId
                );

            if (!removed) {
                return status(404, "Admin not found");
            }

            return status(204);
        },
        {
            // Admin management is a sensitive action (§4.8).
            requireStepUp: true,
            params: t.Object({
                merchantId: t.String(),
                adminId: t.String(),
            }),
            response: {
                204: t.Void(),
                401: StepUpRequired401,
                403: t.String(),
                404: t.String(),
            },
        }
    );
