import {
    Card,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@frak-labs/design-system/components/Card";
import { Text } from "@frak-labs/design-system/components/Text";
import { useSiweAuthenticate } from "@frak-labs/react-sdk";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useTransition } from "react";
import { useTranslation } from "react-i18next";
import { authenticatedBackendApi } from "@/api/backendClient";
import { Button } from "@/module/common/component/Button";
import { EmbeddedShell } from "@/module/embedded/component/EmbeddedShell";
import { useAuthStore } from "@/stores/authStore";

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

    return (
        <EmbeddedShell>
            <Card>
                <CardHeader>
                    <Text variant="overline" color="tertiary">
                        {t("auth.embedded.title")}
                    </Text>
                    <CardTitle>{t("auth.embedded.panelTitle")}</CardTitle>
                    <CardDescription>
                        {t("auth.embedded.subtitle")}
                    </CardDescription>
                </CardHeader>
                <Button
                    variant="primary"
                    width="full"
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
                    {t("auth.embedded.action")}
                </Button>
            </Card>
        </EmbeddedShell>
    );
}
