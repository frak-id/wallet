import { rateLimitMiddleware, sessionContext } from "@backend-infrastructure";
import { t } from "@backend-utils";
import { Elysia } from "elysia";
import { MoneriumContext } from "../../../../domain/monerium";
import {
    MoneriumAuthCallbackBodySchema,
    MoneriumAuthStartBodySchema,
    MoneriumAuthStartResponseSchema,
    MoneriumBeneficiariesResponseSchema,
    MoneriumLinkWalletBodySchema,
    MoneriumLinkWalletResponseSchema,
    MoneriumOrdersResponseSchema,
    MoneriumPlaceOrderBodySchema,
    MoneriumPlaceOrderResponseSchema,
    MoneriumSiweBodySchema,
    MoneriumSiwePrepareResponseSchema,
    MoneriumStatusQuerySchema,
    MoneriumStatusResponseSchema,
    MoneriumSuccessResponseSchema,
} from "../../../../domain/monerium/schemas";

const errors = {
    400: t.ErrorResponse,
    401: t.ErrorResponse,
    409: t.ErrorResponse,
    422: t.ErrorResponse,
    502: t.ErrorResponse,
} as const;

const { auth, status, link, orders } = MoneriumContext.services;

const authRoutes = new Elysia({ prefix: "/auth" })
    .use(sessionContext)
    .use(
        rateLimitMiddleware({
            bucket: "monerium-auth",
            windowMs: 60_000,
            maxRequests: 20,
        })
    )
    .post(
        "/start",
        ({ walletSession, body }) =>
            auth.start({
                wallet: walletSession.address,
                authMode: body.authMode,
            }),
        {
            withWalletAuthent: true,
            body: MoneriumAuthStartBodySchema,
            response: { ...errors, 200: MoneriumAuthStartResponseSchema },
        }
    )
    .post(
        "/callback",
        ({ walletSession, body }) =>
            auth.handleCallback({
                wallet: walletSession.address,
                code: body.code,
                state: body.state,
            }),
        {
            withWalletAuthent: true,
            body: MoneriumAuthCallbackBodySchema,
            response: { ...errors, 200: MoneriumStatusResponseSchema },
        }
    )
    .post(
        "/siwe/prepare",
        ({ walletSession }) =>
            auth.prepareSiwe({ wallet: walletSession.address }),
        {
            withWalletAuthent: true,
            response: { ...errors, 200: MoneriumSiwePrepareResponseSchema },
        }
    )
    .post(
        "/siwe",
        ({ walletSession, body }) =>
            auth.submitSiwe({
                wallet: walletSession.address,
                state: body.state,
                signature: body.signature,
            }),
        {
            withWalletAuthent: true,
            body: MoneriumSiweBodySchema,
            response: { ...errors, 200: MoneriumStatusResponseSchema },
        }
    );

const placeOrderRoute = new Elysia()
    .use(sessionContext)
    .use(
        rateLimitMiddleware({
            bucket: "monerium-place-order",
            windowMs: 60_000,
            maxRequests: 10,
        })
    )
    .post(
        "/orders",
        ({ walletSession, body }) =>
            orders.placeOrder({ wallet: walletSession.address, body }),
        {
            withWalletAuthent: true,
            body: MoneriumPlaceOrderBodySchema,
            response: { ...errors, 200: MoneriumPlaceOrderResponseSchema },
        }
    );

export const moneriumRoutes = new Elysia({ prefix: "/monerium" })
    .use(sessionContext)
    .get(
        "/status",
        ({ walletSession, query }) =>
            status.getStatus(walletSession.address, {
                refresh: query.refresh ?? false,
            }),
        {
            withWalletAuthent: true,
            query: MoneriumStatusQuerySchema,
            response: { ...errors, 200: MoneriumStatusResponseSchema },
        }
    )
    .use(authRoutes)
    .delete(
        "/connection",
        async ({ walletSession }) => {
            await auth.disconnect(walletSession.address);
            return { success: true as const };
        },
        {
            withWalletAuthent: true,
            response: { ...errors, 200: MoneriumSuccessResponseSchema },
        }
    )
    .post(
        "/wallet/link",
        ({ walletSession, body }) =>
            link.linkWallet({
                wallet: walletSession.address,
                signature: body.signature,
            }),
        {
            withWalletAuthent: true,
            body: MoneriumLinkWalletBodySchema,
            response: { ...errors, 200: MoneriumLinkWalletResponseSchema },
        }
    )
    .get(
        "/orders",
        async ({ walletSession }) => ({
            orders: await orders.listOrders(walletSession.address),
        }),
        {
            withWalletAuthent: true,
            response: { ...errors, 200: MoneriumOrdersResponseSchema },
        }
    )
    .use(placeOrderRoute)
    .get(
        "/beneficiaries",
        async ({ walletSession }) => ({
            beneficiaries: await orders.listBeneficiaries(
                walletSession.address
            ),
        }),
        {
            withWalletAuthent: true,
            response: {
                ...errors,
                200: MoneriumBeneficiariesResponseSchema,
            },
        }
    );
