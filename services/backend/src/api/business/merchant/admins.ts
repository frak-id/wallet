import { JwtContext, log } from "@backend-infrastructure";
import { t } from "@backend-utils";
import { Elysia, status } from "elysia";
import type { Address } from "viem";
import {
    type BusinessAccountSelect,
    BusinessAuthContext,
    inviterLabel,
    isCredentialLessAccount,
} from "../../../domain/business-auth";
import { MerchantContext } from "../../../domain/merchant";
import {
    buildInvitationEmail,
    resendClient,
} from "../../../infrastructure/integrations/email";
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
    // Derived, never stored: an account with zero credentials can't log in
    // yet — it's a merchant-team invitation still pending claim.
    status: t.Union([t.Literal("active"), t.Literal("invited")]),
});

/**
 * Account row for a walletless member (cross-domain composition kept in the
 * BFF layer, consistent with the rest of this branch — the merchant domain
 * never reaches into business-auth). Returns the full row so both the email
 * label and the derived `status` come from a single fetch.
 */
async function accountForId(
    accountId: string | null
): Promise<BusinessAccountSelect | null> {
    if (!accountId) return null;
    return BusinessAuthContext.repositories.account.findById(accountId);
}

function statusForAccount(
    account: BusinessAccountSelect | null
): "active" | "invited" {
    if (!account) return "active";
    return isCredentialLessAccount(account) ? "invited" : "active";
}

/**
 * Mint the invitation JWT and send the email off the request path. Failures
 * are logged and swallowed (the admin row is already persisted — the caller
 * can always hit "resend" from the team table); the send is fire-and-forget
 * so a degraded Resend can't hold the admin-add response open.
 */
function sendInvitation(params: {
    account: BusinessAccountSelect & { email: string };
    merchantId: string;
    merchantName: string;
    invitedByAccountId: string | null;
}): void {
    (async () => {
        const inviter = await accountForId(params.invitedByAccountId);

        const token = await JwtContext.businessInvitation.sign({
            typ: "business-invitation",
            sub: params.account.id,
            merchantId: params.merchantId,
            email: params.account.email,
            invitedBy: params.invitedByAccountId,
        });

        const link = `${process.env.BUSINESS_URL}/invite#token=${encodeURIComponent(token)}`;
        const { subject, html } = buildInvitationEmail({
            merchantName: params.merchantName,
            inviterName: inviterLabel(inviter),
            link,
        });

        await resendClient.send({
            to: params.account.email,
            subject,
            html,
        });
    })().catch((error) => {
        log.error(
            { accountId: params.account.id, error },
            "Failed to send merchant invitation email"
        );
    });
}

export const merchantAdminsRoutes = new Elysia({
    prefix: "/:merchantId/admins",
})
    .use(businessSessionContext)
    .get(
        "",
        async ({ params: { merchantId } }) => {
            const [merchant, admins] = await Promise.all([
                MerchantContext.repositories.merchant.findById(merchantId),
                MerchantContext.repositories.merchantAdmin.findByMerchant(
                    merchantId
                ),
            ]);

            if (!merchant) {
                return status(404, "Merchant not found");
            }

            // Owner is always "active": the owning account was created
            // through registration/SSO/SIWE, all of which set a credential.
            const ownerRow = {
                id: merchant.id,
                // Walletless owner — wallet is null, identity is the
                // business account (surfaced via `accountId`/`email`).
                wallet: merchant.ownerWallet,
                accountId: merchant.ownerAccountId,
                email:
                    (await accountForId(merchant.ownerAccountId))?.email ??
                    null,
                addedBy: merchant.ownerWallet,
                addedAt: (merchant.createdAt ?? new Date()).toISOString(),
                isOwner: true,
                status: "active" as const,
            };

            const adminRows = await Promise.all(
                admins.map(async (admin) => {
                    const account = await accountForId(admin.accountId);
                    return {
                        id: admin.id,
                        wallet: admin.wallet,
                        accountId: admin.accountId,
                        email: account?.email ?? null,
                        addedBy: admin.addedBy,
                        addedAt: admin.addedAt.toISOString(),
                        isOwner: false,
                        status: statusForAccount(account),
                    };
                })
            );

            return { admins: [ownerRow, ...adminRows] };
        },
        {
            requireMerchantAccess: true,
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

            // Add by wallet, or resolve/create a business account for the
            // email (§2.7 + merchant-team invitations). Cross-domain
            // composition stays here in the BFF layer, never inside the
            // merchant domain.
            let identity: { wallet: Address } | { accountId: string };
            let resolvedAccount: BusinessAccountSelect | null = null;
            // Set whenever the resolved account is credential-less at the end
            // of this branch — including the create-race case where a
            // concurrent `/register` won and left us a now-credentialed row,
            // which must NOT be (re)treated as an invitation.
            let invitedAccount:
                | (BusinessAccountSelect & { email: string })
                | null = null;
            if ("wallet" in body) {
                identity = { wallet: body.wallet };
            } else {
                const normalizedEmail = body.email.trim().toLowerCase();
                const existing =
                    await BusinessAuthContext.repositories.account.findByEmail(
                        normalizedEmail
                    );
                const resolved =
                    existing && !isCredentialLessAccount(existing)
                        ? existing
                        : (existing ??
                          (await BusinessAuthContext.services.account.createInvitedAccount(
                              normalizedEmail
                          )));
                // Re-check credential-less-ness on the resolved row: a
                // concurrent register can win `createInvitedAccount`'s race
                // and hand back an already-credentialed account.
                if (isCredentialLessAccount(resolved) && resolved.email) {
                    invitedAccount = resolved as BusinessAccountSelect & {
                        email: string;
                    };
                }
                resolvedAccount = resolved;
                identity = { accountId: resolved.id };
            }

            // `addedBy` records whichever identity the actor holds — wallet
            // for wallet sessions, business account for walletless ones.
            const admin = await MerchantContext.repositories.merchantAdmin.add({
                merchantId,
                identity,
                addedBy: businessSession.wallet,
                addedByAccountId: businessSession.accountId,
            });

            if (invitedAccount) {
                const merchant =
                    await MerchantContext.repositories.merchant.findById(
                        merchantId
                    );
                sendInvitation({
                    account: invitedAccount,
                    merchantId,
                    merchantName: merchant?.name ?? "Frak",
                    invitedByAccountId: businessSession.accountId,
                });
            }

            return {
                id: admin.id,
                wallet: admin.wallet,
                accountId: admin.accountId,
                email: resolvedAccount?.email ?? null,
                addedBy: admin.addedBy,
                addedAt: admin.addedAt.toISOString(),
                isOwner: false,
                status: invitedAccount
                    ? ("invited" as const)
                    : ("active" as const),
            };
        },
        {
            // Admin management is a sensitive action (§4.8).
            requireStepUp: true,
            // Consistent with the sibling GET/DELETE routes: uses the
            // plugin's `getMerchantPermissions`, which additionally honors
            // the Shopify-credential grant (§4.7). Its platform-admin grant
            // only satisfies `read`, never `write` — which this POST
            // requires — so the read-only bypass never applies to this
            // mutation.
            requireMerchantAccess: true,
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
        async ({ params: { merchantId, adminId } }) => {
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
            requireMerchantAccess: true,
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
