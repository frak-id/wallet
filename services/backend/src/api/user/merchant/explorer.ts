import { rateLimitMiddleware } from "@backend-infrastructure";
import { t } from "@backend-utils";
import { Elysia } from "elysia";
import { OrchestrationContext } from "../../../orchestration";
import { ExplorerQueryResultSchema } from "../../schemas";

export const exploreApi = new Elysia()
    .use(rateLimitMiddleware({ windowMs: 60_000, maxRequests: 30 }))
    .get(
        "/explore",
        async ({ query: { limit, offset } }) => {
            return OrchestrationContext.orchestrators.explorer.queryMerchants({
                limit,
                offset,
            });
        },
        {
            query: t.Object({
                limit: t.Optional(
                    t.Number({ default: 20, minimum: 1, maximum: 100 })
                ),
                offset: t.Optional(t.Number({ default: 0, minimum: 0 })),
            }),
            response: {
                200: ExplorerQueryResultSchema,
            },
        }
    );
