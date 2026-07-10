import { Inline } from "@frak-labs/design-system/components/Inline";
import { Notice } from "@frak-labs/design-system/components/Notice";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import { useTranslation } from "react-i18next";
import { LoginMethods } from "@/module/auth/component/LoginMethods";
// Imported last so the component-scoped styles win over DS variant styles.
import * as styles from "./login.css";
import logo from "./logo-frak.svg";

// Evaluated once per page load — keeps the footer year current without reading
// the clock during React render.
const currentYear = new Date().getFullYear();

export function Login({
    redirect,
    error,
}: {
    redirect?: string;
    error?: string;
}) {
    const { t } = useTranslation();

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
                    <Text
                        as="span"
                        variant="display1"
                        color="action"
                        className={styles.title}
                    >
                        {t("auth.login.heroTitleLine2")}
                    </Text>
                </Text>
                <Text as="p" className={styles.subtitle}>
                    {t("auth.login.heroSubtitle")}
                </Text>
                {error && (
                    <Notice tone="error">{t("auth.login.ssoError")}</Notice>
                )}
                <LoginMethods redirect={redirect} />
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
