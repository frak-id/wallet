import { t } from "@backend-utils";
import { Elysia, status } from "elysia";
import {
    CurrentGameResponseSchema,
    GameHistoryResponseSchema,
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
        "/history",
        async ({ identityGroupId }) => {
            if (!identityGroupId) return status(401, "Unauthorized");
            const games =
                await OrchestrationContext.orchestrators.gameDraw.results(
                    identityGroupId
                );
            return { games };
        },
        {
            withAuthedIdentity: true,
            response: {
                200: GameHistoryResponseSchema,
                401: t.String(),
            },
        }
    );
