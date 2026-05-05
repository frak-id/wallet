import iphoneBgUrl from "@frak-labs/design-system/assets/iphone.png";
import { Box } from "@frak-labs/design-system/components/Box";
import { Button } from "@frak-labs/design-system/components/Button";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import {
    BellIcon,
    CloseIcon,
    LogoFrakWithName,
    ShieldIcon,
    WalletIcon,
} from "@frak-labs/design-system/icons";
import type { ReactNode } from "react";
import { MerchantLogo } from "../MerchantLogo";
import { overlay } from "../shared.css";
import * as styles from "./postShareConfirmation.css";

export type PostShareConfirmationProps = {
    installUrl: string | null;
    appName: string;
    logoUrl?: string;
    t: (key: string, options?: Record<string, unknown>) => string;
    onDismiss: () => void;
    onShareAgain: () => void;
    onInstall: () => void;
};

const benefits = [
    { key: "wallet", icon: <ShieldIcon width={20} height={20} /> },
    { key: "notify", icon: <BellIcon width={20} height={20} /> },
    { key: "cashout", icon: <WalletIcon width={20} height={20} /> },
] as const;

export function PostShareConfirmation({
    installUrl,
    appName,
    logoUrl,
    t,
    onDismiss,
    onShareAgain,
    onInstall,
}: PostShareConfirmationProps) {
    return (
        <div
            className={overlay}
            onClick={onDismiss}
            onKeyDown={(e) => {
                if (e.key === "Escape") onDismiss();
            }}
        >
            <div
                className={styles.container}
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => e.stopPropagation()}
            >
                <header className={styles.header}>
                    <Box display="flex" alignItems="center" gap="m">
                        <MerchantLogo
                            src={logoUrl}
                            alt={appName}
                            className={styles.merchantLogo}
                        />
                        <LogoFrakWithName
                            className={styles.logo}
                            color="#000"
                        />
                    </Box>
                    <button
                        type="button"
                        className={styles.dismissButton}
                        onClick={onDismiss}
                    >
                        <CloseIcon width={24} height={24} />
                    </button>
                </header>

                <main className={styles.main}>
                    <section className={styles.phoneVisual}>
                        <div className={styles.phoneFrame}>
                            <img
                                src={iphoneBgUrl}
                                alt="iPhone"
                                className={styles.phoneImage}
                            />
                            <div className={styles.phonePopupContent}>
                                <Text
                                    variant="heading6"
                                    className={styles.phonePopupTitle}
                                >
                                    {t(
                                        "sdk.sharingPage.confirmation.cardPopupTitle"
                                    )}
                                </Text>
                                <Text className={styles.phonePopupDesc}>
                                    {t(
                                        "sdk.sharingPage.confirmation.cardPopupDescription"
                                    )}
                                </Text>
                                <MerchantLogo
                                    src={logoUrl}
                                    alt={appName}
                                    className={styles.phonePopupMerchantLogo}
                                />
                            </div>
                        </div>
                    </section>
                    <section className={styles.heroSection}>
                        <Text
                            as="h1"
                            variant="heading3"
                            className={styles.heroSectionTitle}
                        >
                            {t("sdk.sharingPage.confirmation.title")}
                        </Text>
                        <Text variant="bodySmall">
                            {t("sdk.sharingPage.confirmation.subtitle")}
                        </Text>
                    </section>

                    <Stack space="l">
                        {benefits.map(({ key, icon }) => (
                            <BenefitItem
                                key={key}
                                icon={icon}
                                title={t(
                                    `sdk.sharingPage.confirmation.benefits.${key}.title`
                                )}
                                description={t(
                                    `sdk.sharingPage.confirmation.benefits.${key}.description`
                                )}
                            />
                        ))}
                    </Stack>
                </main>

                <footer className={styles.footer}>
                    {installUrl ? (
                        <Button
                            size="large"
                            fontSize="s"
                            width="full"
                            className={styles.ctaButton}
                            onClick={onInstall}
                        >
                            {t("sdk.sharingPage.confirmation.cta")}
                        </Button>
                    ) : (
                        <Button
                            size="large"
                            fontSize="s"
                            width="full"
                            className={styles.ctaButton}
                            disabled
                        >
                            {t("sdk.sharingPage.confirmation.cta")}
                        </Button>
                    )}
                    <button
                        type="button"
                        className={styles.shareAgainButton}
                        onClick={onShareAgain}
                    >
                        {t("sdk.sharingPage.confirmation.shareAgain")}
                    </button>
                </footer>
            </div>
        </div>
    );
}

function BenefitItem({
    icon,
    title,
    description,
}: {
    icon: ReactNode;
    title: string;
    description: string;
}) {
    return (
        <div className={styles.benefitItem}>
            <div className={styles.benefitIcon}>{icon}</div>
            <Stack space="xxs">
                <Text variant="bodySmall" weight="medium">
                    {title}
                </Text>
                <Text variant="bodySmall" color="secondary">
                    {description}
                </Text>
            </Stack>
        </div>
    );
}
