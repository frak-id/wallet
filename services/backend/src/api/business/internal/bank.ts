import { Elysia } from "elysia";
import { OrchestrationContext } from "../../../orchestration/context";
import {
    FrakBankSchema,
    RecheckBankResponseSchema,
} from "../../../orchestration/schemas";
import { businessSessionContext } from "../middleware/session";

const bankAdmin = () => OrchestrationContext.orchestrators.frakBankAdmin;

/** The re-check only pays what the bank can already cover, like its cron: no step-up. */
export const internalBankRoutes = new Elysia({ prefix: "/bank" })
    .use(businessSessionContext)
    .guard({ platformAdminAuthenticated: true })
    .get("/", () => bankAdmin().overview(), {
        response: { 200: FrakBankSchema },
    })
    .post("/recheck", () => bankAdmin().recheck(), {
        response: { 200: RecheckBankResponseSchema },
    });
