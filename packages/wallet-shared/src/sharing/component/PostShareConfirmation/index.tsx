import iphoneBgUrl from "@frak-labs/design-system/assets/iphone.webp";
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
import { clsx } from "clsx";
import type { ReactNode } from "react";
import { MerchantLogo } from "../MerchantLogo";
import { containerChromeless, overlay } from "../shared.css";
import * as styles from "./postShareConfirmation.css";

export type PostShareConfirmationProps = {
    installUrl: string | null;
    appName: string;
    logoUrl?: string;
    t: (key: string, options?: Record<string, unknown>) => string;
    /**
     * Suppress this screen's own header, so a host presenting it inside its
     * own chrome does not stack two logos and two close controls. The footer
     * stays: its install / share-again CTAs are this screen's whole point and
     * have no equivalent in a host's share sheet.
     */
    chromeless?: boolean;
    /**
     * Top corner radius (px) for this screen's own container, only
     * meaningful together with `chromeless`. This is the screen shown right
     * after a share/copy inside the same native host sheet as `SharingPage`
     * (see its `hostCornerRadius` doc), so it needs the identical corners.
     */
    hostCornerRadius?: number;
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
    chromeless = false,
    hostCornerRadius,
    onDismiss,
    onShareAgain,
    onInstall,
}: PostShareConfirmationProps) {
    // Same rationale as `SharingPage`'s identical computation: only applies
    // chromeless, and `container` already sets `overflowY: "auto"` in
    // `postShareConfirmation.css.ts`, which establishes a clip on both axes,
    // so no extra `overflow` is needed here.
    const containerRadiusStyle =
        chromeless && hostCornerRadius && hostCornerRadius > 0
            ? {
                  borderTopLeftRadius: `${hostCornerRadius}px`,
                  borderTopRightRadius: `${hostCornerRadius}px`,
              }
            : undefined;

    return (
        <div
            className={overlay}
            onClick={chromeless ? undefined : onDismiss}
            onKeyDown={(e) => {
                if (!chromeless && e.key === "Escape") onDismiss();
            }}
        >
            <div
                className={clsx(
                    styles.container,
                    chromeless && containerChromeless
                )}
                style={containerRadiusStyle}
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => e.stopPropagation()}
            >
                {!chromeless && (
                    <header className={styles.header}>
                        <Box display="flex" alignItems="center" gap="m">
                            <MerchantLogo
                                src={logoUrl}
                                alt={appName}
                                className={styles.merchantLogo}
                            />
                            <LogoFrakWithName className={styles.logo} />
                        </Box>
                        <button
                            type="button"
                            className={styles.dismissButton}
                            onClick={onDismiss}
                        >
                            <CloseIcon width={24} height={24} />
                        </button>
                    </header>
                )}

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
