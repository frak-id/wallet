import { useDisplayModal, useWalletStatus } from "@frak-labs/react-sdk";
import type { loader } from "app/routes/app";
import { type ReactNode, useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useRouteLoaderData } from "react-router";
import LogoFrak from "../../assets/LogoFrak.svg";
import { EmptyState } from "../ui/EmptyState";
import styles from "./index.module.css";

export function WalletGated({ children }: { children: ReactNode }) {
    const rootData = useRouteLoaderData<typeof loader>("routes/app");
    const url = rootData?.shop?.url;
    const { data: walletStatus } = useWalletStatus();
    const { mutate: displayFrakModal } = useDisplayModal();
    const { t } = useTranslation();
    const [showTimeoutError, setShowTimeoutError] = useState(false);

    useEffect(() => {
        if (walletStatus === undefined) {
            const timeoutId = setTimeout(
                () => setShowTimeoutError(true),
                10000
            );

            return () => clearTimeout(timeoutId);
        }
        setShowTimeoutError(false);
    }, [walletStatus]);

    const authenticate = useCallback(() => {
        displayFrakModal({
            steps: {
                login: {
                    allowSso: true,
                    ssoMetadata: {
                        homepageLink: url,
                    },
                },
            },
        });
    }, [displayFrakModal, url]);

    if (walletStatus === undefined) {
        return (
            <s-page>
                <s-stack direction="inline" gap="small" alignItems="center">
                    {!showTimeoutError && (
                        <s-stack
                            direction="inline"
                            gap="small"
                            alignItems="center"
                        >
                            <s-spinner />
                            <s-heading>{t("common.loading")}</s-heading>
                        </s-stack>
                    )}
                    {showTimeoutError && (
                        <s-banner tone="critical">
                            <p>{t("common.loadingTimeout")}</p>
                        </s-banner>
                    )}
                </s-stack>
            </s-page>
        );
    }

    if (!walletStatus.wallet) {
        return (
            <s-page>
                <s-section>
                    <EmptyState
                        heading={t("gated.configure")}
                        action={{
                            content: t("gated.create"),
                            onAction: authenticate,
                        }}
                        footerContent={
                            <p>
                                <button
                                    type="button"
                                    onClick={authenticate}
                                    className={styles.linkButton}
                                >
                                    {t("gated.alreadyGotAnAccount")}.
                                </button>
                            </p>
                        }
                        image={LogoFrak}
                    >
                        <p>{t("gated.start")}</p>
                    </EmptyState>
                </s-section>
            </s-page>
        );
    }

    return <>{children}</>;
}
