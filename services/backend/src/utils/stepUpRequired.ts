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
 * The single 401 shape for "fresh 2FA required", shared by the `requireStepUp`
 * macro and the `2fa/setup` + `link/*` routes. The whole step-up signal rides
 * in headers (`x-frak-auth-error` + `x-frak-auth-methods`) so the frontend
 * classifies it without parsing the body, which stays a plain `ErrorResponse`.
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
