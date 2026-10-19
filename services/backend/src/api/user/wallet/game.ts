import { t } from "@backend-utils";
import { Elysia, status } from "elysia";
import { CurrentDropResponseSchema } from "../../../domain/game";
import { OrchestrationContext } from "../../../orchestration/context";
import { identityContext } from "../../middleware/identity";

export const gameRoutes = new Elysia({ prefix: "/game" })
    .use(identityContext)
    .get(
        "/drops/current",
        async ({ identityGroupId }) => {
            if (!identityGroupId) return status(401, "Unauthorized");
            return OrchestrationContext.orchestrators.frakGame.getCurrentDrop(
                identityGroupId
            );
        },
        {
            withAuthedIdentity: true,
            response: {
                200: CurrentDropResponseSchema,
                401: t.String(),
            },
        }
    );
