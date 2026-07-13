import { t } from "@backend-utils";
import { Elysia, status } from "elysia";
import { AuthContext } from "../../../domain/auth";
import type { MerchantAccountingInfo } from "../../../domain/merchant";
import {
    MerchantAccountingInfoSchema,
    MerchantContext,
} from "../../../domain/merchant";
import { MerchantIdParamSchema } from "../../schemas";
import { businessSessionContext } from "../middleware/session";

const PartialAccountingInfoSchema = t.Partial(MerchantAccountingInfoSchema);

const AccountingInfoResponseSchema = t.Object({
    accountingInfo: t.Union([PartialAccountingInfoSchema, t.Null()]),
});

// Billing-identity fields a merchant owner/admin may edit
// (billing-feature-plan.md §3.1). These are exactly the fields the
// merchant-facing `BillingInfoSheet` form captures — `vatNumber` and
// `country` are required there, and `country` drives VAT applicability, so
// they must round-trip or the merchant silently loses data.
//
// Allowlist (not a denylist) so any NEW field added to MerchantAccountingInfo
// defaults to platform-admin-writable only, closing the door on accidental
// exposure of future tax-relevant fields.
const MERCHANT_EDITABLE_FIELDS = new Set<keyof MerchantAccountingInfo>([
    "companyName",
    "vatNumber",
    "streetAddress",
    "city",
    "postalCode",
    "country",
    "billingEmail",
]);

export const merchantBillingAccountingRoutes = new Elysia({
    prefix: "/accounting",
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

            const merchant =
                await MerchantContext.repositories.merchant.findById(
                    merchantId
                );
            if (!merchant) {
                return status(404, "Merchant not found");
            }

            return {
                accountingInfo: merchant.accountingInfo ?? null,
            };
        },
        {
            params: MerchantIdParamSchema,
            response: {
                200: AccountingInfoResponseSchema,
                401: t.String(),
                403: t.String(),
                404: t.String(),
            },
        }
    )
    .put(
        "",
        async ({
            params: { merchantId },
            body,
            businessSession,
            shopifySession,
            hasMerchantAccess,
        }) => {
            if (!businessSession && !shopifySession) {
                return status(401, "Authentication required");
            }

            // `hasMerchantAccess`'s platform-admin bypass is read-only
            // (safe methods only), so it would reject a platform admin here
            // even though they must be able to write tax fields (§3.1). This
            // route is the one deliberate exception: a platform admin (trusted
            // Frak staff) is always allowed through; the field-level check
            // below still restricts non-platform-admin callers to the
            // contact fields only.
            const isPlatformAdmin =
                !!businessSession?.wallet &&
                AuthContext.services.platformAdmin.isPlatformAdmin(
                    businessSession.wallet
                );

            const hasAccess =
                isPlatformAdmin || (await hasMerchantAccess(merchantId));
            if (!hasAccess) {
                return status(403, "Access denied");
            }

            const merchant =
                await MerchantContext.repositories.merchant.findById(
                    merchantId
                );
            if (!merchant) {
                return status(404, "Merchant not found");
            }

            // Start from the persisted record. Platform admins may write every
            // field; non-admins may only touch the merchant-editable allowlist,
            // so their payload is filtered down to those keys before merging.
            const existingInfo = merchant.accountingInfo ?? {};
            const incoming = isPlatformAdmin
                ? body
                : Object.fromEntries(
                      Object.entries(body).filter(([field]) =>
                          MERCHANT_EDITABLE_FIELDS.has(
                              field as keyof MerchantAccountingInfo
                          )
                      )
                  );
            const nextInfo: Partial<MerchantAccountingInfo> = {
                ...existingInfo,
                ...incoming,
            };

            await MerchantContext.repositories.merchant.updateAccountingInfo(
                merchantId,
                nextInfo
            );

            return status(204);
        },
        {
            params: MerchantIdParamSchema,
            body: PartialAccountingInfoSchema,
            response: {
                204: t.Void(),
                401: t.String(),
                403: t.String(),
                404: t.String(),
            },
        }
    );
