import { t } from "@backend-utils";
import { Elysia } from "elysia";
import { OrchestrationContext } from "../../../orchestration/context";
import {
    FrakCodeListSchema,
    IssueFrakCodeBodySchema,
} from "../../../orchestration/schemas";
import { businessSessionContext } from "../middleware/session";

const IssuedCodeSchema = t.Object({ id: t.String(), code: t.String() });

const codes = () => OrchestrationContext.orchestrators.frakCodeAdmin;

export const internalReferralCodeRoutes = new Elysia({
    prefix: "/referral-codes",
})
    .use(businessSessionContext)
    .guard({ platformAdminAuthenticated: true })
    .get("/", async () => ({ codes: await codes().list() }), {
        response: { 200: FrakCodeListSchema },
    })
    .post(
        "/",
        async ({ body }) => {
            const { id, code } = await codes().issue(body.code);
            return { id, code };
        },
        { body: IssueFrakCodeBodySchema, response: { 200: IssuedCodeSchema } }
    )
    .post(
        "/:code/revoke",
        async ({ params }) => {
            const { id, code } = await codes().revoke(params.code);
            return { id, code };
        },
        {
            params: t.Object({
                code: t.String({ minLength: 1, maxLength: 16 }),
            }),
            response: { 200: IssuedCodeSchema },
        }
    );
