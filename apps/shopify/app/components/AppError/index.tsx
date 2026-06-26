import { useTranslation } from "react-i18next";

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
 * Friendly, dependency-light error fallback.
 *
 * Rendered from route `ErrorBoundary`s, which run *outside* the
 * `AppProvider`/App Bridge context — so this intentionally uses plain HTML and
 * inline styles instead of Polaris `s-*` web components, which would not render
 * reliably here. It surfaces a reassuring message plus collapsible technical
 * details so a fatal error never shows up as a bare red "Application Error".
 */
export function AppError({ error }: { error: unknown }) {
    const { t } = useTranslation();
    // i18next may not be initialized when the root catch-all boundary is active
    // (its providers are unmounted), so every label carries a hardcoded
    // fallback to avoid rendering raw translation keys on the worst-case path.
    const includeStack = Boolean(import.meta.env?.DEV);
    const { message, detail } = describeError(error, includeStack);

    return (
        <div
            style={{
                fontFamily:
                    "Inter, -apple-system, BlinkMacSystemFont, sans-serif",
                maxWidth: "640px",
                margin: "48px auto",
                padding: "0 16px",
                color: "#202223",
            }}
        >
            <div
                style={{
                    border: "1px solid #e1e3e5",
                    borderRadius: "12px",
                    padding: "20px 24px",
                    background: "#fff",
                }}
            >
                <h1 style={{ fontSize: "18px", margin: "0 0 8px" }}>
                    {t("error.title", {
                        defaultValue: "Something went wrong",
                    })}
                </h1>
                <p style={{ margin: "0 0 16px", color: "#6d7175" }}>
                    {t("error.description", {
                        defaultValue:
                            "An unexpected error occurred while loading this page. Please refresh in a few seconds. If the problem persists, contact Frak support with the details below.",
                    })}
                </p>
                <button
                    type="button"
                    onClick={() => {
                        if (typeof window !== "undefined") {
                            window.location.reload();
                        }
                    }}
                    style={{
                        border: "1px solid #8a8a8a",
                        borderRadius: "8px",
                        padding: "6px 14px",
                        background: "#f6f6f7",
                        cursor: "pointer",
                        fontSize: "14px",
                    }}
                >
                    {t("error.refresh", { defaultValue: "Refresh" })}
                </button>
                <details style={{ marginTop: "16px" }}>
                    <summary
                        style={{
                            cursor: "pointer",
                            color: "#6d7175",
                            fontSize: "13px",
                        }}
                    >
                        {t("error.detailsLabel", {
                            defaultValue: "Technical details",
                        })}
                    </summary>
                    <pre
                        style={{
                            whiteSpace: "pre-wrap",
                            wordBreak: "break-word",
                            background: "#f6f6f7",
                            borderRadius: "8px",
                            padding: "12px",
                            marginTop: "8px",
                            fontSize: "12px",
                            color: "#454545",
                            overflowX: "auto",
                        }}
                    >
                        {message}
                        {detail ? `\n\n${detail}` : ""}
                    </pre>
                </details>
            </div>
        </div>
    );
}
