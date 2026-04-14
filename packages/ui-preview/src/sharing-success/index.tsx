import iphoneBgUrl from "@frak-labs/design-system/assets/iphone.png";
import { Box } from "@frak-labs/design-system/components/Box";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import {
    BellIcon,
    CloseIcon,
    LogoFrakWithName,
    ShieldIcon,
    WalletIcon,
} from "@frak-labs/design-system/icons";
import * as styles from "./styles.css";

export type SharingSuccessPreviewProps = {
    /**
     * Translation function — returns the text for a given key.
     * Keys follow the sdk.sharingPage.confirmation.* namespace.
     */
    t: (key: string) => string;
    /**
     * Merchant logo URL displayed in the header and phone popup.
     */
    logoUrl?: string;
    /**
     * Merchant app name.
     */
    appName?: string;
};

const benefits = [
    { key: "wallet", icon: <ShieldIcon width={18} height={18} /> },
    { key: "notify", icon: <BellIcon width={18} height={18} /> },
    { key: "cashout", icon: <WalletIcon width={18} height={18} /> },
] as const;

/**
 * Preview of the post-share confirmation page: phone visual, hero text, benefits list, CTA button.
 * Mirrors the layout of wallet-shared PostShareConfirmation.
 */
export function SharingSuccessPreview({
    t,
    logoUrl,
    appName,
}: SharingSuccessPreviewProps) {
    return (
        <div className={styles.previewFrame}>
            {/* Header */}
            <header className={styles.header}>
                <Box display="flex" alignItems="center" gap="m">
                    {logoUrl && (
                        <img
                            src={logoUrl}
                            alt={appName ?? ""}
                            className={styles.merchantLogo}
                        />
                    )}
                    <LogoFrakWithName className={styles.logo} color="#000" />
                </Box>
                <span className={styles.dismissIcon}>
                    <CloseIcon width={20} height={20} />
                </span>
            </header>

            {/* Main content */}
            <div className={styles.main}>
                {/* Phone visual */}
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
                            {logoUrl && (
                                <img
                                    src={logoUrl}
                                    alt={appName ?? ""}
                                    className={styles.phonePopupMerchantLogo}
                                />
                            )}
                        </div>
                    </div>
                </section>

                {/* Hero text */}
                <section className={styles.heroSection}>
                    <Text
                        as="h1"
                        variant="heading3"
                        className={styles.heroTitle}
                    >
                        {t("sdk.sharingPage.confirmation.title")}
                    </Text>
                    <Text variant="bodySmall">
                        {t("sdk.sharingPage.confirmation.subtitle")}
                    </Text>
                </section>

                {/* Benefits list */}
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
            </div>

            {/* Footer */}
            <nav className={styles.footer}>
                <div className={styles.ctaButton}>
                    {t("sdk.sharingPage.confirmation.cta")}
                </div>
                <span className={styles.shareAgainButton}>
                    {t("sdk.sharingPage.confirmation.shareAgain")}
                </span>
            </nav>
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
