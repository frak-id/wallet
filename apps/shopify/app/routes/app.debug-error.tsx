/**
 * DEV-ONLY test route. Visiting `/app/debug-error` throws a fatal error so we
 * can verify the friendly error page + correlation id on a deployed non-prod
 * stage, where the real AWS trace headers are present.
 *
 * Inert in production: returns 404 instead of throwing, matching infra's
 * `isProd` check (STAGE === "prod" || includes "production"). The thrown
 * `Error` is a plain (non-Response) error, so it bubbles to `app.tsx`'s
 * `ErrorBoundary` → `AppError`, exactly like a real fatal error.
 *
 * Temporary — revert this commit once the correlation-id path is verified on
 * the dev stage.
 */
export function loader() {
    const stage = process.env.STAGE ?? "";
    if (stage === "prod" || stage.includes("production")) {
        throw new Response("Not Found", { status: 404 });
    }
    throw new Error(
        "Intentional test error from /app/debug-error (correlation-id check)"
    );
}

// Never renders (the loader always throws), but route modules need a default.
export default function DebugError() {
    return null;
}
