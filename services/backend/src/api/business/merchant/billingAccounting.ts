import { eventEmitter } from "@backend-infrastructure";
import { t } from "@backend-utils";
import { Elysia, status } from "elysia";
import type { MerchantAccountingInfo } from "../../../domain/merchant";
import {
    MerchantAccountingInfoSchema,
    MerchantContext,
} from "../../../domain/merchant";
import { MerchantIdParamSchema } from "../../schemas";
import {
    businessSessionContext,
    isPlatformAdminAuth,
} from "../middleware/session";

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
        async ({ params: { merchantId } }) => {
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
            requireMerchantAccess: true,
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
            getMerchantPermissions,
        }) => {
            if (!businessSession && !shopifySession) {
                return status(401, "Authentication required");
            }

            // Deliberate exception to the read-only platform-admin grant:
            // platform admins must write tax fields (§3.1). The field-level
            // allowlist below still restricts everyone else.
            const isPlatformAdmin = businessSession
                ? await isPlatformAdminAuth(businessSession)
                : false;

            const hasAccess =
                isPlatformAdmin ||
                (await getMerchantPermissions(merchantId)).write;
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

            // Wake the monthly-bill sweep: a merchant whose accounting info was
            // previously incomplete is skipped by `backfillMerchant`
            // (isAccountingInfoComplete gate), so its existing deposits never
            // produced bills. Completing/updating the info here lets the sweep
            // generate those missing bills on demand rather than waiting for the
            // daily cron. Same idempotent path as a new deposit — not
            // merchant-scoped; the sweep walks every merchant.
            eventEmitter.emit("merchantAccountingUpdated");

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
