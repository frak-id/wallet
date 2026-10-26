import { t } from "@backend-utils";
import { Elysia, status } from "elysia";
import {
    CurrentGameResponseSchema,
    MyDrawEntrySchema,
} from "../../../domain/game";
import { OrchestrationContext } from "../../../orchestration/context";
import { identityContext } from "../../middleware/identity";

export const gameRoutes = new Elysia({ prefix: "/game" })
    .use(identityContext)
    .get(
        "/current",
        async ({ identityGroupId }) => {
            if (!identityGroupId) return status(401, "Unauthorized");
            return OrchestrationContext.orchestrators.frakGame.getCurrentGame(
                identityGroupId
            );
        },
        {
            withAuthedIdentity: true,
            response: {
                200: CurrentGameResponseSchema,
                401: t.String(),
            },
        }
    )
    .get(
        "/:gameId/draw/me",
        async ({ identityGroupId, params: { gameId } }) => {
            if (!identityGroupId) return status(401, "Unauthorized");
            const entry =
                await OrchestrationContext.orchestrators.gameDraw.myEntry(
                    gameId,
                    identityGroupId
                );
            return entry ?? status(404, "Not in this draw");
        },
        {
            withAuthedIdentity: true,
            params: t.Object({ gameId: t.String({ format: "uuid" }) }),
            response: {
                200: MyDrawEntrySchema,
                401: t.String(),
                404: t.String(),
            },
        }
    );
