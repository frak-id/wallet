import { AUTH_ERROR_HEADER } from "@backend-infrastructure/macro/authError";
import { type ErrorResponse, t } from "./typebox/typeSystem";

export const STEP_UP_ERROR_CODE = "step-up-required";

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
 * response shapes; only the macro emitted the `x-frak-auth-error` header the
 * frontend's `stepUpAwareFetch` looks for. Carries both the header (so the
 * generic 401 interceptor can detect it before parsing the body) and the
 * `{ error, methods }` body (so the 2FA modal knows which methods to offer).
 */
export class StepUpRequiredError extends Error {
    readonly methods: TwoFactorMethod[];

    constructor(methods: TwoFactorMethod[]) {
        super("Fresh two-factor verification required");
        this.name = "StepUpRequiredError";
        this.methods = methods;
    }

    toResponse(): Response {
        const body: {
            error: "step_up_required";
            methods: TwoFactorMethod[];
        } & Partial<ErrorResponse> = {
            error: "step_up_required",
            methods: this.methods,
        };
        return Response.json(body, {
            status: 401,
            headers: { [AUTH_ERROR_HEADER]: STEP_UP_ERROR_CODE },
        });
    }
}
