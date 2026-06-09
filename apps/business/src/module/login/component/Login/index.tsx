import { tablet } from "@frak-labs/design-system/breakpoints";
import { Button } from "@frak-labs/design-system/components/Button";
import { Inline } from "@frak-labs/design-system/components/Inline";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import { useMediaQuery } from "@frak-labs/design-system/hooks/useMediaQuery";
import { useSiweAuthenticate } from "@frak-labs/react-sdk";
import { useNavigate } from "@tanstack/react-router";
import { useTransition } from "react";
import { useTranslation } from "react-i18next";
import { authenticatedBackendApi } from "@/api/backendClient";
import { useAuthStore } from "@/stores/authStore";
// Imported last so the component-scoped styles win over DS variant styles.
import * as styles from "./login.css";
import logo from "./logo-frak.svg";

// SIWE session lifetime: 1 week.
const SESSION_DURATION_MS = 1000 * 60 * 60 * 24 * 7;
// Evaluated once per page load — keeps the footer year current without reading
// the clock during React render.
const currentYear = new Date().getFullYear();

export function Login() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [, startTransition] = useTransition();
    const isMobile = useMediaQuery(`(max-width: ${tablet - 1}px)`);

    const { mutate: authenticate, isPending } = useSiweAuthenticate({
        mutations: {
            onSuccess: async (data) => {
                // Call backend to exchange SIWE for JWT
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
                    navigate({ to: "/dashboard" });
                });
            },
        },
    });

    const handleConnect = () =>
        authenticate({
            siwe: {
                expirationTimeTimestamp: Date.now() + SESSION_DURATION_MS,
            },
        });

    return (
        <div className={styles.login}>
            <Stack as="section" space="l" align="left" className={styles.hero}>
                <a href="https://frak.id" target="_blank" rel="noreferrer">
                    <img
                        src={logo}
                        alt={t("auth.login.frakLabsLogoAlt")}
                        width={105}
                        height={40}
                        className={styles.logo}
                    />
                </a>
                <Text
                    as="h1"
                    variant="display1"
                    color="primary"
                    className={styles.title}
                >
                    {t("auth.login.heroTitleLine1")}
                    <br />
                    <Text as="span" variant="display1" color="action">
                        {t("auth.login.heroTitleLine2")}
                    </Text>
                </Text>
                <Text as="p" className={styles.subtitle}>
                    {t("auth.login.heroSubtitle")}
                </Text>
                <Button
                    variant="primary"
                    size="large"
                    width={isMobile ? "full" : "auto"}
                    loading={isPending}
                    onClick={handleConnect}
                >
                    {t("auth.login.connect")}
                </Button>
            </Stack>

            <aside className={styles.rightPanel}>
                <div className={styles.screenshotCard}>
                    <img
                        src="/assets/login-dashboard.webp"
                        alt={t("auth.login.dashboardImageAlt")}
                        className={styles.screenshot}
                        decoding="async"
                    />
                </div>
            </aside>

            <footer className={styles.footer}>
                <Text variant="caption" color="secondary">
                    {t("auth.login.footerCopyright", { year: currentYear })}
                </Text>
                <Inline space="m" alignY="center">
                    <a
                        href="https://frak.id/terms"
                        target="_blank"
                        rel="noreferrer"
                        className={styles.footerLink}
                    >
                        <Text
                            variant="caption"
                            className={styles.footerLinkText}
                        >
                            {t("auth.login.footerTerms")}
                        </Text>
                    </a>
                    <a
                        href="https://frak.id/privacy"
                        target="_blank"
                        rel="noreferrer"
                        className={styles.footerLink}
                    >
                        <Text
                            variant="caption"
                            className={styles.footerLinkText}
                        >
                            {t("auth.login.footerPrivacy")}
                        </Text>
                    </a>
                </Inline>
            </footer>
        </div>
    );
}
