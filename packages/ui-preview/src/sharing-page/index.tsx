import { Box } from "@frak-labs/design-system/components/Box";
import { NumberedCircle } from "@frak-labs/design-system/components/NumberedCircle";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import { CheckIcon, CopyIcon, ShareIcon } from "@frak-labs/design-system/icons";
import { CardBackground } from "../icons/CardBackground";
import { LogoFrakWithName } from "../icons/LogoFrakWithName";
import * as styles from "./styles.css";

export type SharingPreviewProps = {
    /**
     * Translation function — returns the text for a given key.
     * Keys follow the sdk.sharingPage.* namespace.
     */
    t: (key: string) => string;
    /**
     * Merchant logo URL displayed in the header and credit card.
     */
    logoUrl?: string;
    /**
     * Merchant app name.
     */
    appName?: string;
};

/**
 * Preview of the sharing page header: logo bar, credit card, reward text, stepper, and footer buttons.
 * Mirrors the layout of wallet-shared SharingPage (no FAQ, no description, no products).
 */
export function SharingPreview({ t, logoUrl, appName }: SharingPreviewProps) {
    /** Split a step string at the first period into title + description */
    const splitStep = (text: string) => {
        const dotIndex = text.indexOf(".");
        if (dotIndex === -1) return { title: text, description: undefined };
        return {
            title: text.slice(0, dotIndex + 1),
            description: text.slice(dotIndex + 1).trim() || undefined,
        };
    };

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
                <span className={styles.dismissText}>
                    {t("sdk.sharingPage.dismiss")}
                </span>
            </header>

            {/* Main content */}
            <div className={styles.main}>
                {/* Credit card */}
                <section className={styles.creditCard}>
                    <CardBackground className={styles.creditCardBg} />
                    <div className={styles.creditCardContent}>
                        <div className={styles.creditCardTop}>
                            <span className={styles.creditCardAmount}>
                                {(() => {
                                    const amount = t(
                                        "sdk.sharingPage.card.amount"
                                    );
                                    const match = amount.match(
                                        /^([\d\s]+)([.,]\d+)?\s*(.*)$/
                                    );
                                    if (!match) return amount;
                                    const integer = match[1].trim();
                                    const decimals = match[2] ?? ",00";
                                    const currency = match[3] ?? "";
                                    return (
                                        <>
                                            {integer}
                                            <span
                                                className={
                                                    styles.creditCardCurrency
                                                }
                                            >
                                                {decimals}
                                                {currency}
                                            </span>
                                        </>
                                    );
                                })()}
                            </span>
                            <span className={styles.creditCardLabel}>
                                {t("sdk.sharingPage.card.label")}
                            </span>
                        </div>
                        <div className={styles.creditCardBottom}>
                            <span className={styles.creditCardBottomText}>
                                {t("sdk.sharingPage.card.tagline1")}
                                <br />
                                {t("sdk.sharingPage.card.tagline2")}
                            </span>
                            {logoUrl && (
                                <img
                                    src={logoUrl}
                                    alt={appName ?? ""}
                                    className={styles.creditCardLogo}
                                />
                            )}
                        </div>
                    </div>
                </section>

                {/* Reward text */}
                <section className={styles.rewardCard}>
                    <Text as="h2" variant="heading2">
                        {t("sdk.sharingPage.reward.title")}
                    </Text>
                    <Text variant="bodySmall" color="secondary">
                        {t("sdk.sharingPage.reward.tagline")}
                    </Text>
                </section>

                {/* Stepper */}
                <Stack as="section" space="m">
                    <ol className={styles.stepper}>
                        <li className={styles.stepItem}>
                            <NumberedCircle number={1} color="filled" />
                            <span className={styles.stepConnectorDark} />
                            <Stack space="xxs">
                                <Text variant="bodySmall" weight="semiBold">
                                    {
                                        splitStep(t("sdk.sharingPage.steps.1"))
                                            .title
                                    }
                                </Text>
                                {splitStep(t("sdk.sharingPage.steps.1"))
                                    .description && (
                                    <Text
                                        variant="bodySmall"
                                        className={styles.stepDescription}
                                    >
                                        {
                                            splitStep(
                                                t("sdk.sharingPage.steps.1")
                                            ).description
                                        }
                                    </Text>
                                )}
                            </Stack>
                        </li>
                        <li className={styles.stepItem}>
                            <NumberedCircle number={2} color="filled" />
                            <span className={styles.stepConnector} />
                            <Stack space="xxs">
                                <Text variant="bodySmall" weight="semiBold">
                                    {
                                        splitStep(t("sdk.sharingPage.steps.2"))
                                            .title
                                    }
                                </Text>
                                {splitStep(t("sdk.sharingPage.steps.2"))
                                    .description && (
                                    <Text
                                        variant="bodySmall"
                                        className={styles.stepDescription}
                                    >
                                        {
                                            splitStep(
                                                t("sdk.sharingPage.steps.2")
                                            ).description
                                        }
                                    </Text>
                                )}
                            </Stack>
                        </li>
                        <li className={styles.stepItem}>
                            <NumberedCircle number={3} color="filled" />
                            <Stack space="xxs">
                                <Text variant="bodySmall" weight="semiBold">
                                    {
                                        splitStep(t("sdk.sharingPage.steps.3"))
                                            .title
                                    }
                                </Text>
                                {splitStep(t("sdk.sharingPage.steps.3"))
                                    .description && (
                                    <Text
                                        variant="bodySmall"
                                        className={styles.stepDescription}
                                    >
                                        {
                                            splitStep(
                                                t("sdk.sharingPage.steps.3")
                                            ).description
                                        }
                                    </Text>
                                )}
                            </Stack>
                        </li>
                    </ol>
                </Stack>
            </div>

            {/* Footer buttons */}
            <nav className={styles.footer}>
                <div className={styles.shareButton}>
                    <ShareIcon width={14} height={14} />
                    {t("sharing.btn.share")}
                </div>
                <div className={styles.copyButton}>
                    <CopyIcon width={14} height={14} />
                    {t("sharing.btn.copy")}
                </div>
            </nav>
        </div>
    );
}
