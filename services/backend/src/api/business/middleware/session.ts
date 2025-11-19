import { JwtContext } from "@backend-infrastructure";
import { t } from "@backend-utils";
import { Elysia, status } from "elysia";

/**
 * Build the business context for the app
 */
export const businessSessionContext = new Elysia({
    name: "Context.businessSession",
})
    .guard({
        headers: t.Object({
            "x-business-auth": t.Optional(t.String()),
        }),
    })
    .resolve(async ({ headers }) => {
        const businessAuth = headers["x-business-auth"];
        if (!businessAuth) {
            return { businessSession: null };
        }

        const session = await JwtContext.business.verify(businessAuth);
        return {
            businessSession: session || null,
        };
    })
    .macro({
        businessAuthenticated(skip?: boolean) {
            if (skip) return;

            return {
                beforeHandle: async ({ headers }) => {
                    const businessAuth = headers["x-business-auth"];
                    const session =
                        await JwtContext.business.verify(businessAuth);

                    if (!session) {
                        return status(
                            401,
                            "Unauthorized - Invalid business token"
                        );
                    }
                },
            };
        },
    })
    .as("scoped");
