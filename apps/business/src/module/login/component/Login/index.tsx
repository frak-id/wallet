import { Spinner } from "@frak-labs/design-system/components/Spinner";
import { useMediaQuery } from "@frak-labs/design-system/hooks/useMediaQuery";
import { useSiweAuthenticate } from "@frak-labs/react-sdk";
import { useNavigate } from "@tanstack/react-router";
import clsx from "clsx";
import { useTransition } from "react";
import { useTranslation } from "react-i18next";
import { authenticatedBackendApi } from "@/api/backendClient";
import { ClientOnly } from "@/module/common/component/ClientOnly";
import { useAuthStore } from "@/stores/authStore";
import * as styles from "./login.css";
import logo from "./logo-frak.svg";

export function Login() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [, startTransition] = useTransition();
    const isMobile = useMediaQuery("(max-width : 768px)");

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

    const logoFrakLabs = (
        <ClientOnly>
            <a href="https://frak.id" target="_blank" rel="noreferrer">
                <img
                    src={logo}
                    alt={t("auth.login.frakLabsLogoAlt")}
                    width={111}
                    height={42}
                    className={styles.image}
                />
            </a>
        </ClientOnly>
    );

    return (
        <div className={styles.login}>
            <div>
                {isMobile && logoFrakLabs}
                <h1 className={styles.title}>
                    {t("auth.login.heroTitleLine1")}
                    <br />
                    {t("auth.login.heroTitleLine2")}
                </h1>
                <p className={styles.subTitle}>
                    {t("auth.login.heroSubtitle")}
                </p>
                {!isMobile && (
                    <ClientOnly>
                        <img
                            src="/assets/login-phone.webp"
                            alt={t("auth.login.heroImageAlt")}
                            width={430}
                            height={449}
                            className={clsx(styles.phone, styles.image)}
                        />
                    </ClientOnly>
                )}
            </div>
            <div>
                <div className={styles.panel}>
                    {logoFrakLabs}
                    <p className={styles.text}>{t("auth.login.disclaimer")}</p>
                    <button
                        className={styles.button}
                        type="button"
                        disabled={isPending}
                        onClick={() =>
                            authenticate({
                                siwe: {
                                    // Expire the session after 1 week
                                    expirationTimeTimestamp:
                                        Date.now() + 1000 * 60 * 60 * 24 * 7,
                                },
                            })
                        }
                    >
                        {isPending && <Spinner />} {t("auth.login.connect")}
                    </button>
                </div>
            </div>
            <footer className={styles.footer}>
                <p>{t("auth.login.footerCopyright")}</p>
                <ul className={styles.list}>
                    <li className={styles.listItem}>
                        <a href="/">{t("auth.login.footerTerms")}</a>
                    </li>
                    <li className={styles.listItem}>
                        <a href="/">{t("auth.login.footerPrivacy")}</a>
                    </li>
                </ul>
            </footer>
        </div>
    );
}
