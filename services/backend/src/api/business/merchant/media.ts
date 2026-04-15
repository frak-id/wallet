import { t } from "@backend-utils";
import { Elysia, status } from "elysia";
import { MediaContext } from "../../../domain/media";
import type { ImageType } from "../../../domain/media/services/ImageProcessingService";
import { ImageValidationError } from "../../../domain/media/services/ImageProcessingService";
import { MerchantContext } from "../../../domain/merchant";
import { businessSessionContext } from "../middleware/session";

/**
 * Accepted image MIME types
 */
const acceptedMimeTypes = [
    "image/png",
    "image/jpeg",
    "image/webp",
    "image/svg+xml",
    "image/gif",
] as const;

/**
 * Image type — determines resize constraints and storage key
 */
const imageTypes = ["logo", "hero"] as const;

const MediaErrorSchema = t.Object({
    success: t.Literal(false),
    error: t.String(),
    code: t.String(),
});

export const merchantMediaRoutes = new Elysia({
    prefix: "/:merchantId/media",
})
    .use(businessSessionContext)
    .post(
        "/upload",
        async ({
            params: { merchantId },
            body: { image, type },
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

            // Verify merchant exists
            const merchant =
                await MerchantContext.repositories.merchant.findById(
                    merchantId
                );
            if (!merchant) {
                return status(404, "Merchant not found");
            }

            // Validate mime type
            if (
                !acceptedMimeTypes.includes(
                    image.type as (typeof acceptedMimeTypes)[number]
                )
            ) {
                return status(400, {
                    success: false as const,
                    error: `Invalid image type: ${image.type}. Accepted: ${acceptedMimeTypes.join(", ")}`,
                    code: "invalid_mime_type",
                });
            }

            // Process image (validate dimensions + resize + compress to WebP)
            try {
                const processed =
                    await MediaContext.services.imageProcessing.process(
                        image,
                        type as ImageType
                    );

                // Upload to RustFS bucket
                const url = await MediaContext.repositories.mediaStorage.upload(
                    {
                        merchantId,
                        type: type as ImageType,
                        body: processed.buffer,
                        contentType: processed.contentType,
                    }
                );

                return { url };
            } catch (e) {
                if (e instanceof ImageValidationError) {
                    return status(400, {
                        success: false as const,
                        error: e.message,
                        code: e.code,
                    });
                }
                throw e;
            }
        },
        {
            params: t.Object({
                merchantId: t.String(),
            }),
            body: t.Object({
                image: t.File({
                    maxSize: "10m",
                }),
                type: t.Union(imageTypes.map((v) => t.Literal(v))),
            }),
            response: {
                200: t.Object({ url: t.String() }),
                400: MediaErrorSchema,
                401: t.String(),
                403: t.String(),
                404: t.String(),
            },
        }
    )
    .delete(
        "/:type",
        async ({
            params: { merchantId, type },
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

            await MediaContext.repositories.mediaStorage.delete({
                merchantId,
                type: type as ImageType,
            });

            return { success: true };
        },
        {
            params: t.Object({
                merchantId: t.String(),
                type: t.Union(imageTypes.map((v) => t.Literal(v))),
            }),
            response: {
                200: t.Object({ success: t.Literal(true) }),
                401: t.String(),
                403: t.String(),
            },
        }
    )
    .get(
        "/list",
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

            const files = await MediaContext.repositories.mediaStorage.list({
                merchantId,
            });

            return { files };
        },
        {
            params: t.Object({
                merchantId: t.String(),
            }),
            response: {
                200: t.Object({
                    files: t.Array(
                        t.Object({
                            type: t.Union([
                                t.Literal("logo"),
                                t.Literal("hero"),
                            ]),
                            url: t.String(),
                        })
                    ),
                }),
                401: t.String(),
                403: t.String(),
            },
        }
    );
