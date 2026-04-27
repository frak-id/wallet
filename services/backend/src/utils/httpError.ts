import type { ErrorResponse } from "./typebox/typeSystem";

/**
 * Standard HTTP error for the whole backend. Throw this from anywhere
 * (service, repository, orchestrator, handler) to surface a typed 4xx/5xx
 * response. Elysia's runtime auto-detects the `toResponse()` method on a
 * thrown error and uses it to build the HTTP response — no per-route
 * `.error()` registration or `.onError` mapper required.
 *
 * Body shape is the canonical `t.ErrorResponse` (`{ success: false, code,
 * error }`), so any route declaring `response: { 4xx: t.ErrorResponse }`
 * is correctly typed for Eden Treaty consumers without extra wiring.
 *
 * Usage:
 * ```ts
 * throw HttpError.conflict("ALREADY_ACTIVE", "User already has an active code");
 * throw HttpError.notFound("CODE_NOT_FOUND", "Referral code does not exist");
 * throw new HttpError({ status: 418, code: "TEAPOT", message: "..." }); // custom
 * ```
 */
export class HttpError extends Error {
    readonly status: number;
    readonly code: string;

    constructor(opts: { status: number; code: string; message: string }) {
        super(opts.message);
        this.name = "HttpError";
        this.status = opts.status;
        this.code = opts.code;
    }

    /**
     * Elysia consults this method when an error is thrown — the returned
     * Response is sent to the client as-is. We emit the canonical
     * `t.ErrorResponse` body shape so route response schemas line up
     * automatically.
     */
    toResponse(): Response {
        const body: ErrorResponse = {
            success: false,
            code: this.code,
            error: this.message,
        };
        return Response.json(body, { status: this.status });
    }

    static badRequest(code: string, message: string): HttpError {
        return new HttpError({ status: 400, code, message });
    }

    static unauthorized(code: string, message: string): HttpError {
        return new HttpError({ status: 401, code, message });
    }

    static forbidden(code: string, message: string): HttpError {
        return new HttpError({ status: 403, code, message });
    }

    static notFound(code: string, message: string): HttpError {
        return new HttpError({ status: 404, code, message });
    }

    static conflict(code: string, message: string): HttpError {
        return new HttpError({ status: 409, code, message });
    }

    static unprocessable(code: string, message: string): HttpError {
        return new HttpError({ status: 422, code, message });
    }

    static tooManyRequests(code: string, message: string): HttpError {
        return new HttpError({ status: 429, code, message });
    }

    static internal(code: string, message: string): HttpError {
        return new HttpError({ status: 500, code, message });
    }
}
