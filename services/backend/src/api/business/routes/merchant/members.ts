import { extractShopDomain } from "@backend-infrastructure";
import { t } from "@backend-utils";
import { Elysia, status } from "elysia";
import { MerchantContext } from "../../../../domain/merchant";
import { OrchestrationContext } from "../../../../orchestration/context";
import {
    MemberFilterSchema,
    MemberQueryResultSchema,
    MemberSortSchema,
} from "../../../../orchestration/schemas/memberSchemas";
import { businessSessionContext } from "../../middleware/session";

async function resolveAccessibleMerchantIds(
    businessSession: { wallet: `0x${string}` } | null,
    shopifySession: { dest: string } | null
): Promise<string[]> {
    if (businessSession) {
        return MerchantContext.services.authorization.getAccessibleMerchantIds(
            businessSession.wallet
        );
    }

    if (shopifySession) {
        const shopDomain = extractShopDomain(shopifySession.dest);
        if (!shopDomain) return [];
        const merchant =
            await MerchantContext.repositories.merchant.findByDomain(
                shopDomain
            );
        return merchant ? [merchant.id] : [];
    }

    return [];
}

export const merchantMembersRoutes = new Elysia({ prefix: "/members" })
    .use(businessSessionContext)
    .post(
        "",
        async ({ body, businessSession, shopifySession }) => {
            if (!businessSession && !shopifySession) {
                return status(401, "Authentication required");
            }

            const merchantIds = await resolveAccessibleMerchantIds(
                businessSession,
                shopifySession
            );

            return OrchestrationContext.orchestrators.memberQuery.queryMembers(
                merchantIds,
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
        async ({ body, businessSession, shopifySession }) => {
            if (!businessSession && !shopifySession) {
                return status(401, "Authentication required");
            }

            const merchantIds = await resolveAccessibleMerchantIds(
                businessSession,
                shopifySession
            );

            const count =
                await OrchestrationContext.orchestrators.memberQuery.countMembers(
                    merchantIds,
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
