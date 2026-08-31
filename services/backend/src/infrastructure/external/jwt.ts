import { t } from "@backend-utils";
import { INSTALL_TICKET_TTL_MS } from "@frak-labs/app-essentials/constants/installTicket";
import { getSchemaValidator, type Static, type TSchema } from "elysia";

import {
    type JWSHeaderParameters,
    type JWTPayload,
    type JWTVerifyOptions,
    jwtVerify,
    SignJWT,
} from "jose";
import { BusinessTokenDto } from "../../domain/auth/models/BusinessSessionDto";
import {
    WalletSdkTokenDto,
    WalletTokenDto,
} from "../../domain/auth/models/WalletSessionDto";
import { BusinessInvitationTokenDto } from "../../domain/business-auth/models/BusinessInvitationTokenDto";
import { AnonymousMergeTokenDto } from "../../domain/identity/models/AnonymousMergeTokenDto";
import { InstallTicketDto } from "../../domain/identity/models/InstallTicketDto";
import { OriginResumeTokenDto } from "../../domain/pairing/models/OriginResumeTokenDto";

export namespace JwtContext {
    export const wallet = buildJwtContext({
        secret: process.env.JWT_SECRET as string,
        schema: WalletTokenDto,
        // 30 days
        expirationDelayInSecond: 60 * 60 * 24 * 30,
        // Default jwt payload
        iss: "frak.id",
    });
    export const walletSdk = buildJwtContext({
        secret: process.env.JWT_SDK_SECRET as string,
        schema: WalletSdkTokenDto,
        // One day
        expirationDelayInSecond: 60 * 60 * 24,
        // Default jwt payload
        iss: "frak.id",
    });
    export const business = buildJwtContext({
        secret: process.env.JWT_BUSINESS_SECRET as string,
        schema: BusinessTokenDto,
        expirationDelayInSecond: 60 * 60 * 24 * 7,
        iss: "frak.id",
    });
    export const anonymousMerge = buildJwtContext({
        secret: process.env.JWT_SDK_SECRET as string,
        schema: AnonymousMergeTokenDto,
        // 60 minutes - user may browse before leaving in-app browser.
        // `MergeSender.kt`'s `holdTimeoutMillis` mirrors this value and ships
        // in a store binary, so cutting it here alone drops native merge rows
        // at 401 — move both together.
        expirationDelayInSecond: 60 * 60,
        iss: "frak-identity",
    });
    /**
     * Install ticket — minted unconditionally by `install-code/resolve`,
     * consumed by `/identity/ensure`. Its TTL is mirrored by the wallet's
     * pending-action store, which prunes the ticket at the same value.
     * Not single-use — a burn-set would deadlock the wallet's retry loop.
     */
    export const installTicket = buildJwtContext({
        secret: process.env.JWT_SDK_SECRET as string,
        schema: InstallTicketDto,
        aud: "install-ticket",
        expirationDelayInSecond: INSTALL_TICKET_TTL_MS / 1000,
        iss: "frak-identity",
    });
    /**
     * Merchant-team email invitation link (single-purpose action token,
     * mirrors `anonymousMerge`). Shares `JWT_BUSINESS_SECRET` with the
     * legacy `business` session context — the schema's `typ` literal is the
     * cross-acceptance guard, see `BusinessInvitationTokenDto`.
     */
    export const businessInvitation = buildJwtContext({
        secret: process.env.JWT_BUSINESS_SECRET as string,
        schema: BusinessInvitationTokenDto,
        // 7 days — long enough that an invitee checking their inbox late
        // still finds a working link; resend covers expiry in practice.
        expirationDelayInSecond: 60 * 60 * 24 * 7,
        iss: "frak.id",
    });
    /**
     * Used to authenticate origin-side `action=resume` requests when the
     * origin's WS dropped before a wallet token existed. Reuses the wallet
     * JWT secret — shorter expiry to bound the replay window.
     */
    export const originResume = buildJwtContext({
        secret: process.env.JWT_SECRET as string,
        schema: OriginResumeTokenDto,
        // 10 minutes — mirrors the backend's idle-pairing TTL.
        expirationDelayInSecond: 60 * 10,
        iss: "frak.id",
    });
}

type UnwrapSchema<
    Schema extends TSchema | undefined,
    Fallback = unknown,
> = Schema extends TSchema ? Static<NonNullable<Schema>> : Fallback;

interface JWTPayloadSpec {
    iss?: string;
    sub?: string;
    aud?: string | string[];
    jti?: string;
    nbf?: number;
    exp?: number;
    iat?: number;
}

interface JWTOption<Schema extends TSchema | undefined = undefined>
    extends JWSHeaderParameters,
        Omit<JWTPayload, "nbf" | "exp"> {
    /**
     * JWT Secret
     */
    secret: string | Uint8Array;
    /**
     * Type strict validation for JWT payload
     */
    schema?: Schema;
    /**
     * Potential epxiration delay in seconds if exp isn't provided.
     */
    expirationDelayInSecond?: number;

    /**
     * JWT Not Before
     *
     * @see [RFC7519#section-4.1.5](https://www.rfc-editor.org/rfc/rfc7519#section-4.1.5)
     */

    nbf?: string | number;
    /**
     * JWT Expiration Time
     *
     * @see [RFC7519#section-4.1.4](https://www.rfc-editor.org/rfc/rfc7519#section-4.1.4)
     */
    exp?: string | number;
}

/**
 * Create a JWT Context
 */
function buildJwtContext<const Schema extends TSchema | undefined = undefined>({
    secret,
    expirationDelayInSecond,
    // Start JWT Header
    alg = "HS256",
    crit,
    schema,
    // End JWT Header
    // Start JWT Payload
    nbf,
    exp,
    ...payload
    // End JWT Payload
}: JWTOption<Schema>) {
    if (!secret) throw new Error("Secret can't be empty");

    // Get the key for the given secret
    const key =
        typeof secret === "string" ? new TextEncoder().encode(secret) : secret;

    // Validate the user's schema directly and pass the JWT-spec claims as
    // additional accepted properties via `validators`. This matches the
    // canonical @elysiajs/jwt pattern and — unlike `t.Composite`/`t.Intersect`
    // — it preserves discriminated-union members (variant-specific fields
    // would be silently dropped otherwise).
    const validator = schema
        ? getSchemaValidator(schema, {
              modules: t.Module({}),
              validators: [
                  t.Object({
                      iss: t.Optional(t.String()),
                      sub: t.Optional(t.String()),
                      aud: t.Optional(
                          t.Union([t.String(), t.Array(t.String())])
                      ),
                      jti: t.Optional(t.String()),
                      nbf: t.Optional(t.Number()),
                      exp: t.Optional(t.Number()),
                      iat: t.Optional(t.Number()),
                  }),
              ],
          })
        : undefined;

    type JwtPayload = UnwrapSchema<Schema, Record<string, string | number>> &
        JWTPayloadSpec;

    // When a context declares an audience, enforce it on verify (below).
    // Relying on the payload schema alone is not enough: the JWT-spec claims
    // are merged in as `aud: optional string`, which widens any `t.Literal` a
    // schema declares — so a token minted under a different audience, with
    // the same secret and payload shape, would otherwise verify.
    const audience = payload.aud as string | string[] | undefined;
    const verifyOptions: JWTVerifyOptions = audience ? { audience } : {};

    return {
        /**
         * Sign a JWT token
         */
        sign(morePayload: JwtPayload) {
            let jwt = new SignJWT({
                ...payload,
                ...morePayload,
                nbf: undefined,
                exp: undefined,
                iat: undefined,
            })
                .setProtectedHeader({
                    alg,
                    crit,
                })
                // RFC-7519 NumericDate (seconds). Set centrally so callers
                // never pass a millisecond `iat` by hand again.
                .setIssuedAt();

            if (nbf) jwt = jwt.setNotBefore(nbf);

            // Set the expiration time
            if (exp || expirationDelayInSecond) {
                const expiration =
                    exp ??
                    Math.floor(
                        Date.now() / 1000 + (expirationDelayInSecond ?? 0)
                    );
                jwt.setExpirationTime(expiration);
            }

            return jwt.sign(key);
        },

        /**
         * Verify a JWT token
         */
        async verify(jwt?: string): Promise<JwtPayload | false> {
            if (!jwt) return false;

            try {
                const data = (
                    await jwtVerify<JwtPayload>(jwt, key, verifyOptions)
                ).payload;

                // Validate payload against schema if present
                if (validator && !validator.Check(data)) return false;

                return data;
            } catch (_) {
                return false;
            }
        },
    };
}
