import { t } from "@backend-utils";
import {
    type Static,
    type TSchema,
    ValidationError,
    getSchemaValidator,
} from "elysia";
import {
    type JWSHeaderParameters,
    type JWTPayload,
    SignJWT,
    jwtVerify,
} from "jose";
import {
    WalletSdkTokenDto,
    WalletTokenDto,
} from "../../domain/auth/models/WalletSessionDto";

export namespace JwtContext {
    export const wallet = buildJwtContext({
        secret: process.env.JWT_SECRET as string,
        schema: WalletTokenDto,
        // Default jwt payload
        iss: "frak.id",
    });
    export const walletSdk = buildJwtContext({
        secret: process.env.JWT_SDK_SECRET as string,
        schema: WalletSdkTokenDto,
        // One week
        expirationDelayInSecond: 60 * 60 * 24 * 7,
        // Default jwt payload
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
     * Potential epxiration delay in seconds if exp isn't provided
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

    // Get the validator for the given schema
    const validator = schema
        ? getSchemaValidator(
              t.Intersect([
                  schema,
                  t.Partial(
                      t.Object({
                          iss: t.String(),
                          sub: t.String(),
                          aud: t.Union([t.String(), t.Array(t.String())]),
                          jti: t.String(),
                          nbf: t.Number(),
                          exp: t.Number(),
                          iat: t.String(),
                      })
                  ),
              ]),
              { modules: t.Module({}) }
          )
        : undefined;

    type JwtPayload = UnwrapSchema<Schema, Record<string, string | number>> &
        JWTPayloadSpec;

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
            }).setProtectedHeader({
                alg,
                crit,
            });

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
                const data = (await jwtVerify<JwtPayload>(jwt, key)).payload;

                if (validator?.Check(data))
                    throw new ValidationError("JWT", validator, data);

                return data;
            } catch (_) {
                return false;
            }
        },
    };
}
