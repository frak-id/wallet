import { HttpError, t } from "@backend-utils";
import { isRunningInProd } from "@frak-labs/app-essentials";
import { Elysia, status } from "elysia";
import {
    InstagramContext,
    InstagramLinkResponseSchema,
    MockInstagramLinkBodySchema,
    mockIgsidOf,
    normalizeInstagramHandle,
} from "../../../domain/instagram";
import { identityContext } from "../../middleware/identity";

/**
 * Stands in for Meta's webhook until it ships: the caller declares the handle
 * and the follow state, and the same `instagram_links` row gets written. The
 * guard runs before the auth macro, so production answers 404 to anyone.
 */
const mockRoutes = new Elysia({ prefix: "/mock" })
    .use(identityContext)
    .onBeforeHandle(() => {
        if (isRunningInProd) return status(404, "Not Found");
    })
    .put(
        "/",
        async ({ identityGroupId, body }) => {
            if (!identityGroupId) return status(401, "Unauthorized");
            const username = normalizeInstagramHandle(body.username);
            if (!username) {
                throw HttpError.badRequest(
                    "INVALID_INSTAGRAM_HANDLE",
                    "Not a valid Instagram handle"
                );
            }
            const link = await InstagramContext.services.instagramLink.link({
                identityGroupId,
                igsid: mockIgsidOf(username),
                username,
                follows: body.follows,
            });
            return { link };
        },
        {
            withAuthedIdentity: true,
            body: MockInstagramLinkBodySchema,
            response: {
                200: InstagramLinkResponseSchema,
                400: t.ErrorResponse,
                401: t.String(),
                404: t.String(),
                409: t.ErrorResponse,
            },
        }
    )
    .delete(
        "/",
        async ({ identityGroupId }) => {
            if (!identityGroupId) return status(401, "Unauthorized");
            await InstagramContext.services.instagramLink.unlink(
                identityGroupId
            );
            return { link: null };
        },
        {
            withAuthedIdentity: true,
            response: {
                200: InstagramLinkResponseSchema,
                401: t.String(),
                404: t.String(),
            },
        }
    );

export const instagramRoutes = new Elysia({ prefix: "/instagram" })
    .use(identityContext)
    .get(
        "/",
        async ({ identityGroupId }) => {
            if (!identityGroupId) return status(401, "Unauthorized");
            const link =
                await InstagramContext.services.instagramLink.find(
                    identityGroupId
                );
            return { link };
        },
        {
            withAuthedIdentity: true,
            response: {
                200: InstagramLinkResponseSchema,
                401: t.String(),
            },
        }
    )
    .use(mockRoutes);
