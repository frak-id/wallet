import { t } from "@backend-utils";
import { Elysia, status } from "elysia";
import { PublicDrawSchema } from "../../domain/game";
import { OrchestrationContext } from "../../orchestration/context";

/** Public on purpose: anyone can replay a draw from this record. */
export const gameRoutes = new Elysia({ prefix: "/game" }).get(
    "/:gameId/draw",
    async ({ params: { gameId } }) => {
        const draw =
            await OrchestrationContext.orchestrators.gameDraw.publicDraw(
                gameId
            );
        return draw ?? status(404, "Not drawn yet");
    },
    {
        params: t.Object({ gameId: t.String({ format: "uuid" }) }),
        response: { 200: PublicDrawSchema, 404: t.String() },
    }
);
