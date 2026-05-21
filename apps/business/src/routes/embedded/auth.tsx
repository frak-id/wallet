import { Spinner } from "@frak-labs/design-system/components/Spinner";
import { useSiweAuthenticate } from "@frak-labs/react-sdk";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useTransition } from "react";
import { useTranslation } from "react-i18next";
import { authenticatedBackendApi } from "@/api/backendClient";
import { Button } from "@/module/common/component/Button";
import { Panel } from "@/module/common/component/Panel";
import { Title } from "@/module/common/component/Title";
import { useAuthStore } from "@/stores/authStore";
import { button, container, title } from "./auth.css";

export const Route = createFileRoute("/embedded/auth")({
    component: EmbeddedAuthPage,
    validateSearch: (search: Record<string, unknown>) => {
        return {
            redirect: (search.redirect as string | undefined) ?? "/embedded",
        };
    },
});

function EmbeddedAuthPage() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { redirect } = Route.useSearch();
    const [, startTransition] = useTransition();

    const isAuthenticatedInStore = useAuthStore((state) =>
        state.isAuthenticated()
    );

    const { mutate: authenticate, isPending } = useSiweAuthenticate({
        mutations: {
            onSuccess: async (data) => {
                const response = await authenticatedBackendApi.auth.login.post({
                    message: data.message,
                    signature: data.signature,
                });

                if (response.error) {
                    console.error("Login failed:", response.error);
                    return;
                }

                useAuthStore
                    .getState()
                    .setAuth(
                        response.data.token,
                        response.data.wallet,
                        response.data.expiresAt
                    );

                startTransition(() => {
                    navigate({ to: redirect });
                });
            },
        },
    });

    if (isAuthenticatedInStore) {
        navigate({ to: redirect });
        return null;
    }

    if (isPending) {
        return (
            <div className={container}>
                <Spinner />
            </div>
        );
    }

    return (
        <div className={container}>
            <Title className={title}>{t("auth.embedded.title")}</Title>
            <Panel withBadge={false} title={t("auth.embedded.panelTitle")}>
                <Button
                    variant="secondary"
                    size="small"
                    className={button}
                    onClick={() =>
                        authenticate({
                            siwe: {
                                expirationTimeTimestamp:
                                    Date.now() + 1000 * 60 * 60 * 24 * 7,
                            },
                        })
                    }
                    loading={isPending}
                    disabled={isPending}
                >
                    {isPending && <Spinner />} {t("auth.embedded.action")}
                </Button>
            </Panel>
        </div>
    );
}
