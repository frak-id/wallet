import {
    AUTH_ERROR_HEADER,
    AUTH_METHODS_HEADER,
} from "@backend-infrastructure/macro/authError";
import { type ErrorResponse, t } from "./typebox/typeSystem";

/** Value of the `x-frak-auth-error` header on a step-up 401. */
export const STEP_UP_ERROR_CODE = "step-up-required";
/** Machine-readable `code` in the step-up 401 body (a plain `ErrorResponse`). */
export const STEP_UP_BODY_CODE = "STEP_UP_REQUIRED";

/** The single Typebox DTO for a 2FA method, shared across every route. */
export const TwoFactorMethodDto = t.Union([
    t.Literal("email"),
    t.Literal("totp"),
    t.Literal("siwe"),
]);

export type TwoFactorMethod = typeof TwoFactorMethodDto.static;

/**
 * The single 401 shape for "fresh 2FA required" (design doc §4.5/§4.8),
 * shared by the `requireStepUp` macro (`api/business/middleware/session.ts`)
 * and the `2fa/setup` + `link/*` routes (`api/business/auth/`) — three call
 * sites previously reimplemented the same freshness check with inconsistent
 * response shapes. The step-up signal now lives entirely in headers — the
 * `x-frak-auth-error: step-up-required` discriminator plus an
 * `x-frak-auth-methods` list of the offered 2FA methods — so the frontend
 * classifies it without parsing the body, and the body is the same plain
 * `t.ErrorResponse` shape every other error uses.
 */
export class StepUpRequiredError extends Error {
    readonly methods: TwoFactorMethod[];

    constructor(methods: TwoFactorMethod[]) {
        super("Fresh two-factor verification required");
        this.name = "StepUpRequiredError";
        this.methods = methods;
    }

    toResponse(): Response {
        const body: ErrorResponse = {
            success: false,
            code: STEP_UP_BODY_CODE,
            error: this.message,
        };
        return Response.json(body, {
            status: 401,
            headers: {
                [AUTH_ERROR_HEADER]: STEP_UP_ERROR_CODE,
                [AUTH_METHODS_HEADER]: this.methods.join(","),
            },
        });
    }
}
