import { HttpError, t } from "@backend-utils";
import { isRunningInProd } from "@frak-labs/app-essentials";
import { Elysia, status } from "elysia";
import {
    DeclareInstagramBodySchema,
    InstagramContext,
    InstagramLinkCodeResponseSchema,
    InstagramStatusSchema,
    MockInstagramLinkBodySchema,
    mockIgsidOf,
    normalizeInstagramHandle,
    readInstagramConfig,
} from "../../../domain/instagram";
import { identityContext } from "../../middleware/identity";

/**
 * Non-prod stand-in for a certification: the caller declares the handle and
 * the follow state, and the same `instagram_links` row gets written. The guard
 * runs before the auth macro, so production answers 404 to anyone.
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
            const service = InstagramContext.services.instagramLink;
            await service.link({
                identityGroupId,
                igsid: mockIgsidOf(username),
                username,
                follows: body.follows,
            });
            return service.status(identityGroupId);
        },
        {
            withAuthedIdentity: true,
            body: MockInstagramLinkBodySchema,
            response: {
                200: InstagramStatusSchema,
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
            const service = InstagramContext.services.instagramLink;
            await service.unlink(identityGroupId);
            return service.status(identityGroupId);
        },
        {
            withAuthedIdentity: true,
            response: {
                200: InstagramStatusSchema,
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
            return InstagramContext.services.instagramLink.status(
                identityGroupId
            );
        },
        {
            withAuthedIdentity: true,
            response: {
                200: InstagramStatusSchema,
                401: t.String(),
            },
        }
    )
    .put(
        "/declaration",
        async ({ identityGroupId, body }) => {
            if (!identityGroupId) return status(401, "Unauthorized");
            return InstagramContext.services.instagramLink.declare(
                identityGroupId,
                body.username
            );
        },
        {
            withAuthedIdentity: true,
            body: DeclareInstagramBodySchema,
            response: {
                200: InstagramStatusSchema,
                400: t.ErrorResponse,
                401: t.String(),
                409: t.ErrorResponse,
            },
        }
    )
    .delete(
        "/declaration",
        async ({ identityGroupId }) => {
            if (!identityGroupId) return status(401, "Unauthorized");
            return InstagramContext.services.instagramLink.undeclare(
                identityGroupId
            );
        },
        {
            withAuthedIdentity: true,
            response: {
                200: InstagramStatusSchema,
                401: t.String(),
            },
        }
    )
    .post(
        "/code",
        async ({ identityGroupId }) => {
            if (!identityGroupId) return status(401, "Unauthorized");
            // A code nobody can receive would only send players to a dead DM.
            if (!readInstagramConfig()) {
                throw HttpError.badGateway(
                    "INSTAGRAM_UNAVAILABLE",
                    "Instagram certification is not available"
                );
            }
            const code =
                await InstagramContext.services.instagramLink.issueCode(
                    identityGroupId
                );
            return { code };
        },
        {
            withAuthedIdentity: true,
            response: {
                200: InstagramLinkCodeResponseSchema,
                401: t.String(),
                502: t.ErrorResponse,
            },
        }
    )
    .post(
        "/check",
        async ({ identityGroupId }) => {
            if (!identityGroupId) return status(401, "Unauthorized");
            return InstagramContext.services.instagramVerification.check(
                identityGroupId
            );
        },
        {
            withAuthedIdentity: true,
            response: {
                200: InstagramStatusSchema,
                401: t.String(),
                502: t.ErrorResponse,
            },
        }
    )
    .use(mockRoutes);
