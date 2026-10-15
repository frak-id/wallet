import { sessionContext } from "@backend-infrastructure";
import { HttpError, t } from "@backend-utils";
import { Elysia } from "elysia";
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

function notImplemented(): never {
    throw HttpError.internal("NOT_IMPLEMENTED", "Not implemented yet");
}

export const moneriumRoutes = new Elysia({ prefix: "/monerium" })
    .use(sessionContext)
    .get("/status", () => notImplemented(), {
        withWalletAuthent: true,
        query: MoneriumStatusQuerySchema,
        response: { ...errors, 200: MoneriumStatusResponseSchema },
    })
    .post("/auth/start", () => notImplemented(), {
        withWalletAuthent: true,
        body: MoneriumAuthStartBodySchema,
        response: { ...errors, 200: MoneriumAuthStartResponseSchema },
    })
    .post("/auth/callback", () => notImplemented(), {
        withWalletAuthent: true,
        body: MoneriumAuthCallbackBodySchema,
        response: { ...errors, 200: MoneriumStatusResponseSchema },
    })
    .post("/auth/siwe/prepare", () => notImplemented(), {
        withWalletAuthent: true,
        response: { ...errors, 200: MoneriumSiwePrepareResponseSchema },
    })
    .post("/auth/siwe", () => notImplemented(), {
        withWalletAuthent: true,
        body: MoneriumSiweBodySchema,
        response: { ...errors, 200: MoneriumStatusResponseSchema },
    })
    .delete("/connection", () => notImplemented(), {
        withWalletAuthent: true,
        response: { ...errors, 200: MoneriumSuccessResponseSchema },
    })
    .post("/wallet/link", () => notImplemented(), {
        withWalletAuthent: true,
        body: MoneriumLinkWalletBodySchema,
        response: { ...errors, 200: MoneriumLinkWalletResponseSchema },
    })
    .get("/orders", () => notImplemented(), {
        withWalletAuthent: true,
        response: { ...errors, 200: MoneriumOrdersResponseSchema },
    })
    .post("/orders", () => notImplemented(), {
        withWalletAuthent: true,
        body: MoneriumPlaceOrderBodySchema,
        response: { ...errors, 200: MoneriumPlaceOrderResponseSchema },
    })
    .get("/beneficiaries", () => notImplemented(), {
        withWalletAuthent: true,
        response: { ...errors, 200: MoneriumBeneficiariesResponseSchema },
    });
