import { t } from "@backend-utils";
import { Elysia } from "elysia";
import {
    DrawStatusSchema,
    GameStatusSchema,
} from "../../../domain/game/schemas";
import { OrchestrationContext } from "../../../orchestration/context";
import { parseFrakMerchantOwner } from "../../../orchestration/internal";
import {
    CreateGameBodySchema,
    DrawVerificationSchema,
    FrakGameSetupSchema,
    GameAdminListSchema,
    GameDrawResponseSchema,
    GamePlayersQuerySchema,
    GamePlayersSchema,
    PublishSignupRuleBodySchema,
    RejectCandidateBodySchema,
    RunDrawsResponseSchema,
    SeedFrakMerchantBodySchema,
    SetGameStatusBodySchema,
} from "../../../orchestration/schemas";
import { businessSessionContext } from "../middleware/session";
import { actorOf, ownerOf } from "./actor";

const GameIdParamSchema = t.Object({ gameId: t.String({ format: "uuid" }) });
const IdSchema = t.Object({ id: t.String() });
const DrawStatusResponseSchema = t.Object({ status: DrawStatusSchema });

const admin = () => OrchestrationContext.orchestrators.frakGameAdmin;
const gameDraw = () => OrchestrationContext.orchestrators.gameDraw;

/** Money moves (a rule's budget, a prize) need a fresh 2FA on top of the platform-admin gate. */
export const internalGameRoutes = new Elysia({ prefix: "/game" })
    .use(businessSessionContext)
    .guard({ platformAdminAuthenticated: true })
    .get("/setup", () => admin().setup(), {
        response: { 200: FrakGameSetupSchema },
    })
    .post(
        "/setup/merchant",
        async ({ body, businessSession }) => {
            const { merchant, created } = await admin().seedMerchant({
                domain: body.domain,
                owner: body.owner
                    ? parseFrakMerchantOwner(body.owner)
                    : ownerOf(businessSession),
            });
            return { id: merchant.id, domain: merchant.domain, created };
        },
        {
            body: SeedFrakMerchantBodySchema,
            response: {
                200: t.Object({
                    id: t.String(),
                    domain: t.String(),
                    created: t.Boolean(),
                }),
            },
        }
    )
    .post(
        "/setup/signup-rule",
        async ({ body }) => {
            const { id } = await admin().publishSignupRule(body);
            return { id };
        },
        {
            requireStepUp: true,
            body: PublishSignupRuleBodySchema,
            response: { 200: IdSchema },
        }
    )
    .get("/", async () => ({ games: await admin().listGames() }), {
        response: { 200: GameAdminListSchema },
    })
    .post(
        "/",
        async ({ body }) => {
            const { id } = await admin().createGame(body);
            return { id };
        },
        {
            requireStepUp: true,
            body: CreateGameBodySchema,
            response: { 200: IdSchema },
        }
    )
    .post("/run-draws", () => gameDraw().runDue(), {
        response: { 200: RunDrawsResponseSchema },
    })
    .post(
        "/:gameId/status",
        async ({ params, body }) => {
            const game = await admin().setStatus(params.gameId, body.status);
            return { status: game.status };
        },
        {
            params: GameIdParamSchema,
            body: SetGameStatusBodySchema,
            response: { 200: t.Object({ status: GameStatusSchema }) },
        }
    )
    .get(
        "/:gameId/players",
        ({ params, query }) =>
            admin().playersOf(params.gameId, query.fresh === true),
        {
            params: GameIdParamSchema,
            query: GamePlayersQuerySchema,
            response: { 200: GamePlayersSchema },
        }
    )
    .get(
        "/:gameId/draw",
        async ({ params }) => ({ draw: await admin().drawOf(params.gameId) }),
        { params: GameIdParamSchema, response: { 200: GameDrawResponseSchema } }
    )
    .get(
        "/:gameId/draw/verify",
        async ({ params }) => ({
            checks: await admin().verifyDraw(params.gameId),
        }),
        { params: GameIdParamSchema, response: { 200: DrawVerificationSchema } }
    )
    .post(
        "/:gameId/draw/freeze",
        async ({ params }) => {
            const draw = await admin().freeze(params.gameId);
            return { status: draw.status };
        },
        {
            params: GameIdParamSchema,
            response: { 200: DrawStatusResponseSchema },
        }
    )
    .post(
        "/:gameId/draw/reject",
        async ({ params, body, businessSession }) => {
            const draw = await gameDraw().reject(
                params.gameId,
                body.reason,
                await actorOf(businessSession)
            );
            return { status: draw.status };
        },
        {
            params: GameIdParamSchema,
            body: RejectCandidateBodySchema,
            response: { 200: DrawStatusResponseSchema },
        }
    )
    .post(
        "/:gameId/draw/confirm",
        async ({ params, businessSession }) => {
            const draw = await gameDraw().confirm(
                params.gameId,
                await actorOf(businessSession)
            );
            return { status: draw.status };
        },
        {
            requireStepUp: true,
            params: GameIdParamSchema,
            response: { 200: DrawStatusResponseSchema },
        }
    );
