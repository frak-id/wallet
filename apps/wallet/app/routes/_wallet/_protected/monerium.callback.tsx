import { Spinner } from "@frak-labs/ui/component/Spinner";
import { useMutation } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { moneriumStore } from "@/module/monerium/store/moneriumStore";
import { exchangeCodeForTokens } from "@/module/monerium/utils/moneriumApi";

export const Route = createFileRoute("/_wallet/_protected/monerium/callback")({
    component: MoneriumCallback,
    validateSearch: (search: Record<string, unknown>) => ({
        code: (search.code as string) || undefined,
        state: (search.state as string) || undefined,
    }),
});

function MoneriumCallback() {
    const { t } = useTranslation();
    const { code } = Route.useSearch();
    const hasStartedRef = useRef(false);

    const { mutate, isError, error } = useMutation({
        mutationFn: async ({
            code,
            codeVerifier,
        }: {
            code: string;
            codeVerifier: string;
        }) => {
            const tokens = await exchangeCodeForTokens(code, codeVerifier);

            moneriumStore
                .getState()
                .setTokens(
                    tokens.access_token,
                    tokens.refresh_token,
                    tokens.expires_in,
                    tokens.profile
                );

            moneriumStore.getState().setPendingCodeVerifier(null);
        },
        onSuccess: () => {
            window.location.replace("/wallet");
        },
    });

    useEffect(() => {
        if (hasStartedRef.current) return;

        if (!code) return;

        const codeVerifier = moneriumStore.getState().pendingCodeVerifier;
        if (!codeVerifier) return;

        hasStartedRef.current = true;
        mutate({ code, codeVerifier });
    }, [code, mutate]);

    if (!code) {
        return (
            <div
                style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "1rem",
                    padding: "2rem",
                    minHeight: "50vh",
                }}
            >
                <p>{t("monerium.callback.noCode")}</p>
                <button
                    type={"button"}
                    onClick={() => window.location.replace("/wallet")}
                >
                    {t("monerium.callback.tryAgain")}
                </button>
            </div>
        );
    }

    if (isError) {
        return (
            <div
                style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "1rem",
                    padding: "2rem",
                    minHeight: "50vh",
                }}
            >
                <p>
                    {error instanceof Error
                        ? error.message
                        : t("monerium.callback.failed")}
                </p>
                <button
                    type={"button"}
                    onClick={() => window.location.replace("/wallet")}
                >
                    {t("monerium.callback.tryAgain")}
                </button>
            </div>
        );
    }

    return <Spinner />;
}
