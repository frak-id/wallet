import { createHash } from "node:crypto";
import { HttpError, t } from "@backend-utils";
import { Elysia, status } from "elysia";
import { MediaContext } from "../../../domain/media";
import type { ImageType } from "../../../domain/media/services/ImageProcessingService";
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
 * Image type accepted by the upload endpoint.
 *  - logo / hero: single fixed-key images.
 *  - hero-extra: triggers hash-suffixed storage (hero-{hash}) for slider variants.
 */
const imageTypes = ["logo", "hero"] as const;
const uploadTypes = [...imageTypes, "hero-extra"] as const;

// Pattern allowed for media keys (used by delete endpoint).
const mediaTypePattern = /^(logo|hero(-[a-zA-Z0-9_-]+)?)$/;

// Derive an 8-char hex hash from image content so identical uploads collide.
function generateContentHash(buffer: Buffer | Uint8Array): string {
    return createHash("sha256").update(buffer).digest("hex").slice(0, 8);
}

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
                throw HttpError.badRequest(
                    "INVALID_MIME_TYPE",
                    `Invalid image type: ${image.type}. Accepted: ${acceptedMimeTypes.join(", ")}`
                );
            }

            // Determine storage key + processing constraints
            //  - hero-extra → hero-{contentHash} on disk, validated as a hero image
            //  - logo / hero → stored under their canonical key
            const isHeroExtra = type === "hero-extra";
            const processingType: ImageType = isHeroExtra ? "hero" : type;

            // Process image (validate dimensions + resize + compress to WebP).
            // ImageProcessingService throws HttpError directly on validation
            // failure; Elysia handles it via toResponse().
            const processed =
                await MediaContext.services.imageProcessing.process(
                    image,
                    processingType
                );

            const storageType = isHeroExtra
                ? `hero-${generateContentHash(processed.buffer)}`
                : type;

            // Reject duplicate hero-extra uploads (same content → same hash)
            if (isHeroExtra) {
                const exists =
                    await MediaContext.repositories.mediaStorage.exists({
                        merchantId,
                        type: storageType,
                    });
                if (exists) {
                    throw HttpError.conflict(
                        "DUPLICATE_IMAGE",
                        "This image is already uploaded"
                    );
                }
            }

            // Upload to RustFS bucket
            const url = await MediaContext.repositories.mediaStorage.upload({
                merchantId,
                type: storageType,
                body: processed.buffer,
                contentType: processed.contentType,
            });

            return { url, type: storageType };
        },
        {
            params: t.Object({
                merchantId: t.String(),
            }),
            body: t.Object({
                image: t.File({
                    maxSize: "10m",
                }),
                type: t.Union(uploadTypes.map((v) => t.Literal(v))),
            }),
            response: {
                200: t.Object({ url: t.String(), type: t.String() }),
                400: t.ErrorResponse,
                409: t.ErrorResponse,
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

            // Validate type pattern: logo, hero, or hero-{variant}
            if (!mediaTypePattern.test(type)) {
                throw HttpError.badRequest(
                    "INVALID_MEDIA_TYPE",
                    `Invalid media type: ${type}`
                );
            }

            await MediaContext.repositories.mediaStorage.delete({
                merchantId,
                type,
            });

            return { success: true };
        },
        {
            params: t.Object({
                merchantId: t.String(),
                type: t.String(),
            }),
            response: {
                200: t.Object({ success: t.Literal(true) }),
                400: t.ErrorResponse,
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
                            type: t.String(),
                            url: t.String(),
                        })
                    ),
                }),
                401: t.String(),
                403: t.String(),
            },
        }
    );
