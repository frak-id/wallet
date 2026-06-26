import { useTranslation } from "react-i18next";
import styles from "./AppError.module.css";

/**
 * Extract a short, safe message plus an optional verbose detail (stack) from an
 * unknown error. The stack is only surfaced in development — in a merchant's
 * production admin it would expose internal paths and framework internals —
 * while the concise `message` is always shown to help support triage.
 */
function describeError(
    error: unknown,
    includeStack: boolean
): { message: string; detail?: string } {
    if (error instanceof Error) {
        return {
            message: error.message || error.name,
            detail: includeStack ? error.stack : undefined,
        };
    }
    if (typeof error === "string") {
        return { message: error };
    }
    try {
        return { message: JSON.stringify(error) };
    } catch {
        return { message: "Unknown error" };
    }
}

/**
 * Friendly error fallback.
 *
 * Rendered from route `ErrorBoundary`s, which run *outside* the
 * `AppProvider`/App Bridge context — so this uses plain HTML + a CSS Module
 * instead of Polaris `s-*` web components, which would not render reliably
 * here. It surfaces a reassuring message plus collapsible technical details so
 * a fatal error never shows up as a bare red "Application Error".
 */
export function AppError({
    error,
    requestId,
}: {
    error: unknown;
    // From the root loader via each ErrorBoundary's `useRouteLoaderData`. Same
    // value on server + client (no hydration mismatch); falsy → line omitted.
    requestId?: string | null;
}) {
    const { t } = useTranslation();
    // i18next may not be initialized when the root catch-all boundary is active
    // (its providers are unmounted), so every label carries a hardcoded
    // fallback to avoid rendering raw translation keys on the worst-case path.
    const includeStack = Boolean(import.meta.env?.DEV);
    const { message, detail } = describeError(error, includeStack);

    return (
        <div className={styles.container}>
            <div className={styles.card}>
                <h1 className={styles.title}>
                    {t("error.title", {
                        defaultValue: "Something went wrong",
                    })}
                </h1>
                <p className={styles.description}>
                    {t("error.description", {
                        defaultValue:
                            "An unexpected error occurred while loading this page. Please refresh in a few seconds. If the problem persists, contact Frak support with the details below.",
                    })}
                </p>
                {requestId && (
                    <p className={styles.reference}>
                        {t("error.reference", { defaultValue: "Reference" })}:{" "}
                        <code className={styles.referenceId}>{requestId}</code>{" "}
                        <span className={styles.referenceHint}>
                            (
                            {t("error.referenceHint", {
                                defaultValue: "share this with Frak support",
                            })}
                            )
                        </span>
                    </p>
                )}
                <button
                    type="button"
                    className={styles.refresh}
                    onClick={() => {
                        if (typeof window !== "undefined") {
                            window.location.reload();
                        }
                    }}
                >
                    {t("error.refresh", { defaultValue: "Refresh" })}
                </button>
                <details className={styles.details}>
                    <summary className={styles.detailsSummary}>
                        {t("error.detailsLabel", {
                            defaultValue: "Technical details",
                        })}
                    </summary>
                    <pre className={styles.stack}>
                        {message}
                        {detail ? `\n\n${detail}` : ""}
                    </pre>
                </details>
            </div>
        </div>
    );
}
