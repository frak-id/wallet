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
import { type ReactNode, useRef } from "react";
import { MerchantLogo } from "../MerchantLogo";
import {
    isChromeless,
    type SharingChrome,
    type SharingMerchant,
    type SharingT,
} from "../SharingPage/types";
import { containerChromeless, overlay, overlayChromeless } from "../shared.css";
import { useOverlayBehaviour } from "../useOverlayBehaviour";
import * as styles from "./postShareConfirmation.css";

export type PostShareConfirmationProps = {
    installUrl: string | null;
    merchant: SharingMerchant;
    t: SharingT;
    /**
     * The same chrome the share screen uses — this is the screen shown right
     * after a share/copy inside the very same host sheet, so it must round its
     * corners identically and suppress its own header on exactly the same
     * condition. Sharing the type is what stops the two drifting apart.
     *
     * Under `mode: "none"` the header goes (a host presenting this inside its
     * own chrome would otherwise stack two logos and two close controls) but
     * the footer stays: its install / share-again CTAs are this screen's whole
     * point and have no equivalent in a host's share sheet.
     */
    chrome: SharingChrome;
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
    merchant,
    t,
    chrome,
    onDismiss,
    onShareAgain,
    onInstall,
}: PostShareConfirmationProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const chromeless = isChromeless(chrome);

    useOverlayBehaviour({
        enabled: !chromeless,
        onDismiss,
        containerRef,
    });

    return (
        // biome-ignore lint/a11y/useKeyWithClickEvents: dismissal has a keyboard equivalent in `useOverlayBehaviour`'s document-level Escape listener, not a per-element handler — the backdrop is never focusable.
        <div
            className={clsx(overlay, chromeless && overlayChromeless)}
            onClick={chromeless ? undefined : onDismiss}
        >
            {/* biome-ignore lint/a11y/useKeyWithClickEvents: onClick only stops the backdrop's dismiss-on-click from firing; same rationale as the backdrop above. */}
            <div
                ref={containerRef}
                className={clsx(
                    styles.container,
                    chromeless && containerChromeless
                )}
                role="dialog"
                aria-modal="true"
                tabIndex={-1}
                onClick={(e) => e.stopPropagation()}
            >
                {!chromeless && (
                    <header className={styles.header}>
                        <Box display="flex" alignItems="center" gap="m">
                            <MerchantLogo
                                src={merchant.logoUrl}
                                alt={merchant.name}
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
                                    src={merchant.logoUrl}
                                    alt={merchant.name}
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
