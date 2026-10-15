import { t } from "@backend-utils";
import type { Static } from "elysia";

export const MoneriumProfileStateSchema = t.Union([
    t.Literal("created"),
    t.Literal("incomplete"),
    t.Literal("pending"),
    t.Literal("review"),
    t.Literal("approved"),
    t.Literal("rejected"),
    t.Literal("closed"),
]);

export const MoneriumConnectionStateSchema = t.Union([
    t.Literal("none"),
    t.Literal("connected"),
    t.Literal("reauth_required"),
]);
export type MoneriumConnectionState = Static<
    typeof MoneriumConnectionStateSchema
>;

export const MoneriumWalletLinkStateSchema = t.Union([
    t.Literal("none"),
    t.Literal("pending"),
    t.Literal("linked"),
]);
export type MoneriumWalletLinkState = Static<
    typeof MoneriumWalletLinkStateSchema
>;

export const MoneriumStatusResponseSchema = t.Object({
    connection: MoneriumConnectionStateSchema,
    profile: t.Union([
        t.Null(),
        t.Object({
            id: t.String(),
            kind: t.Union([t.Literal("personal"), t.Literal("corporate")]),
            state: MoneriumProfileStateSchema,
            reasonCode: t.Optional(t.String()),
        }),
    ]),
    walletLink: MoneriumWalletLinkStateSchema,
    /** A Sign-In-With-Ethereum reconnect is worth trying before the Monerium portal. */
    silentReconnect: t.Boolean(),
    environment: t.Union([t.Literal("sandbox"), t.Literal("production")]),
});
export type MoneriumStatusResponse = Static<
    typeof MoneriumStatusResponseSchema
>;

export const MoneriumStatusQuerySchema = t.Object({
    refresh: t.Optional(t.BooleanString()),
});

export const MoneriumAuthStartBodySchema = t.Object({
    authMode: t.Optional(t.Union([t.Literal("login"), t.Literal("signup")])),
});

export const MoneriumAuthStartResponseSchema = t.Object({
    url: t.String(),
});

export const MoneriumAuthCallbackBodySchema = t.Object({
    code: t.String({ minLength: 1 }),
    state: t.String({ minLength: 1 }),
});

export const MoneriumSiwePrepareResponseSchema = t.Object({
    state: t.String(),
    message: t.String(),
});

export const MoneriumSiweBodySchema = t.Object({
    state: t.String({ minLength: 1 }),
    signature: t.Hex(),
});

export const MoneriumLinkWalletBodySchema = t.Object({
    signature: t.Hex(),
});

export const MoneriumLinkWalletResponseSchema = t.Object({
    walletLink: MoneriumWalletLinkStateSchema,
});

export const MoneriumOrderStateSchema = t.Union([
    t.Literal("placed"),
    t.Literal("pending"),
    t.Literal("processed"),
    t.Literal("rejected"),
]);

export const MoneriumCounterpartSchema = t.Object({
    iban: t.Optional(t.String()),
    own: t.Boolean(),
    firstName: t.Optional(t.String()),
    lastName: t.Optional(t.String()),
    companyName: t.Optional(t.String()),
    country: t.Optional(t.String()),
});

export const MoneriumOrderSchema = t.Object({
    id: t.String(),
    kind: t.Union([t.Literal("issue"), t.Literal("redeem")]),
    state: MoneriumOrderStateSchema,
    amount: t.String(),
    currency: t.String(),
    chain: t.String(),
    address: t.Address(),
    counterpart: MoneriumCounterpartSchema,
    memo: t.Optional(t.String()),
    placedAt: t.String(),
    processedAt: t.Optional(t.String()),
    rejectedReason: t.Optional(t.String()),
    txHashes: t.Array(t.Hex()),
});
export type MoneriumOrderDto = Static<typeof MoneriumOrderSchema>;

export const MoneriumOrdersResponseSchema = t.Object({
    orders: t.Array(MoneriumOrderSchema),
});

export const MoneriumPlaceOrderBodySchema = t.Object({
    /** Client-generated UUID, reused on retry so a network failure cannot double-pay. */
    orderId: t.String({ format: "uuid" }),
    amount: t.String(),
    iban: t.String(),
    counterpart: t.Union([
        t.Object({ own: t.Literal(true) }),
        t.Object({
            own: t.Literal(false),
            firstName: t.String(),
            lastName: t.String(),
            country: t.String(),
        }),
    ]),
    memo: t.Optional(t.String()),
    message: t.String(),
    signature: t.Hex(),
});
export type MoneriumPlaceOrderBody = Static<
    typeof MoneriumPlaceOrderBodySchema
>;

export const MoneriumPlaceOrderResponseSchema = t.Object({
    orderId: t.String(),
    /** Null while Monerium waits on an on-chain signature (HTTP 202 upstream). */
    order: t.Union([t.Null(), MoneriumOrderSchema]),
});

export const MoneriumBeneficiarySchema = t.Object({
    iban: t.String(),
    own: t.Boolean(),
    firstName: t.Optional(t.String()),
    lastName: t.Optional(t.String()),
    country: t.Optional(t.String()),
    lastUsedAt: t.String(),
});

export const MoneriumBeneficiariesResponseSchema = t.Object({
    beneficiaries: t.Array(MoneriumBeneficiarySchema),
});

export const MoneriumSuccessResponseSchema = t.Object({
    success: t.Literal(true),
});

/** Machine-readable `code` values in `t.ErrorResponse` bodies from the Monerium routes. */
export const moneriumErrorCodes = {
    notConnected: "MONERIUM_NOT_CONNECTED",
    reauthRequired: "MONERIUM_REAUTH_REQUIRED",
    authStateInvalid: "MONERIUM_AUTH_STATE_INVALID",
    tokenExchangeFailed: "MONERIUM_TOKEN_EXCHANGE_FAILED",
    siweRejected: "MONERIUM_SIWE_REJECTED",
    siweUnavailable: "MONERIUM_SIWE_UNAVAILABLE",
    profileNotApproved: "MONERIUM_PROFILE_NOT_APPROVED",
    linkRejected: "MONERIUM_LINK_REJECTED",
    invalidAmount: "MONERIUM_INVALID_AMOUNT",
    amountLimit: "MONERIUM_AMOUNT_LIMIT",
    invalidIban: "MONERIUM_INVALID_IBAN",
    invalidCounterpart: "MONERIUM_INVALID_COUNTERPART",
    invalidMemo: "MONERIUM_INVALID_MEMO",
    invalidMessage: "MONERIUM_INVALID_MESSAGE",
    messageExpired: "MONERIUM_MESSAGE_EXPIRED",
    walletNotLinked: "MONERIUM_WALLET_NOT_LINKED",
    orderRejected: "MONERIUM_ORDER_REJECTED",
    upstreamUnavailable: "MONERIUM_UPSTREAM_UNAVAILABLE",
} as const;
export type MoneriumErrorCode =
    (typeof moneriumErrorCodes)[keyof typeof moneriumErrorCodes];
