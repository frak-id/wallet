import { HttpError, t } from "@backend-utils";
import { Elysia, status } from "elysia";
import {
    DeclareInstagramBodySchema,
    InstagramContext,
    InstagramLinkCodeResponseSchema,
    InstagramStatusSchema,
    readInstagramConfig,
} from "../../../domain/instagram";
import { identityContext } from "../../middleware/identity";

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
    );
