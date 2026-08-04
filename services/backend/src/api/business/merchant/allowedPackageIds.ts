import { HttpError, t } from "@backend-utils";
import { isValidPackageId } from "@frak-labs/app-essentials";
import { Elysia, status } from "elysia";
import { MerchantContext, normalizePackageId } from "../../../domain/merchant";
import { MerchantIdParamSchema, PackageIdBodySchema } from "../../schemas";
import { businessSessionContext } from "../middleware/session";

export const merchantAllowedPackageIdsRoutes = new Elysia()
    .use(businessSessionContext)
    .post(
        "/:merchantId/allowed-package-ids",
        async ({ params: { merchantId }, body: { packageId, platform } }) => {
            if (!isValidPackageId(packageId)) {
                throw HttpError.badRequest(
                    "INVALID_PACKAGE_ID",
                    `Invalid package id: "${packageId}"`
                );
            }

            const packageKey = normalizePackageId(packageId, platform);

            // Resolution picks the first row containing the key, so letting two
            // merchants claim one app would make its resolve result arbitrary.
            const owner =
                await MerchantContext.repositories.merchant.findByAllowedPackageId(
                    packageKey
                );
            if (owner && owner.id !== merchantId) {
                throw HttpError.conflict(
                    "PACKAGE_ID_ALREADY_CLAIMED",
                    `Package id "${packageId}" is already claimed by another merchant`
                );
            }

            const updated =
                await MerchantContext.repositories.merchant.addAllowedPackageId(
                    merchantId,
                    packageKey
                );
            if (!updated) {
                return status(404, "Merchant not found");
            }

            MerchantContext.services.resolve.invalidateForMerchant(updated);

            return status(204);
        },
        {
            requireMerchantAccess: true,
            params: MerchantIdParamSchema,
            body: PackageIdBodySchema,
            response: {
                204: t.Void(),
                400: t.ErrorResponse,
                401: t.String(),
                403: t.String(),
                404: t.String(),
                409: t.ErrorResponse,
            },
        }
    )
    .delete(
        "/:merchantId/allowed-package-ids",
        async ({ params: { merchantId }, body: { packageId, platform } }) => {
            const merchant =
                await MerchantContext.repositories.merchant.findById(
                    merchantId
                );
            if (!merchant) {
                return status(404, "Merchant not found");
            }

            const packageKey = normalizePackageId(packageId, platform);
            const filtered = (merchant.allowedPackageIds ?? []).filter(
                (key) => key !== packageKey
            );

            await MerchantContext.repositories.merchant.setAllowedPackageIds(
                merchantId,
                filtered
            );

            // Invalidate against the pre-update record: the key being dropped
            // is only present there.
            MerchantContext.services.resolve.invalidateForMerchant(merchant);

            return status(204);
        },
        {
            requireMerchantAccess: true,
            params: MerchantIdParamSchema,
            body: PackageIdBodySchema,
            response: {
                204: t.Void(),
                401: t.String(),
                403: t.String(),
                404: t.String(),
            },
        }
    );
