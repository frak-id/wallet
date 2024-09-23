import Elysia from "elysia";
import { t } from "../../../common";
import { businessContext } from "../context";

export const businessOracleContext = new Elysia({
    name: "business-oracle-context",
})
    .use(businessContext)
    .guard({
        params: t.Object({
            productId: t.Optional(t.Hex()),
        }),
    })
    .as("plugin");
