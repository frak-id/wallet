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

type UnwrapSchema<
    Schema extends TSchema | undefined,
    Fallback = unknown,
> = Schema extends TSchema ? Static<NonNullable<Schema>> : Fallback;

export interface JWTPayloadSpec {
    iss?: string;
    sub?: string;
    aud?: string | string[];
    jti?: string;
    nbf?: number;
    exp?: number;
    iat?: number;
}

export interface JWTOption<Schema extends TSchema | undefined = undefined>
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

export type JwtService<Schema extends TSchema | undefined = undefined> = {
    sign: (payload: UnwrapSchema<Schema>) => Promise<string>;
    verify: (jwt: string) => Promise<UnwrapSchema<Schema> | false>;
};

/**
 * JCreate a JWT Context
 */
export function buildJwtContext<
    const Schema extends TSchema | undefined = undefined,
>({
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
