import { t } from "@backend-utils";
import { Elysia, status } from "elysia";
import { OrchestrationContext } from "../../../../orchestration/context";
import {
    MemberFilterSchema,
    MemberQueryResultSchema,
    MemberSortSchema,
} from "../../../../orchestration/schemas/memberSchemas";
import { businessSessionContext } from "../../middleware/session";

export const merchantMembersRoutes = new Elysia({ prefix: "/members" })
    .use(businessSessionContext)
    .post(
        "",
        async ({ body, businessSession }) => {
            if (!businessSession) {
                return status(401, "Authentication required");
            }

            return OrchestrationContext.orchestrators.memberQuery.queryMembers(
                businessSession.wallet,
                {
                    limit: body.limit,
                    offset: body.offset,
                    sort: body.sort,
                    filter: body.filter,
                }
            );
        },
        {
            body: t.Object({
                limit: t.Optional(t.Number()),
                offset: t.Optional(t.Number()),
                sort: t.Optional(MemberSortSchema),
                filter: t.Optional(MemberFilterSchema),
            }),
            response: {
                200: MemberQueryResultSchema,
                401: t.String(),
            },
        }
    )
    .post(
        "/count",
        async ({ body, businessSession }) => {
            if (!businessSession) {
                return status(401, "Authentication required");
            }

            const count =
                await OrchestrationContext.orchestrators.memberQuery.countMembers(
                    businessSession.wallet,
                    body.filter
                );

            return { count };
        },
        {
            body: t.Object({
                filter: t.Optional(MemberFilterSchema),
            }),
            response: {
                200: t.Object({ count: t.Number() }),
                401: t.String(),
            },
        }
    );
