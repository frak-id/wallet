import type { SharingPageProduct } from "@frak-labs/core-sdk";
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@frak-labs/design-system/components/Accordion";
import { Box } from "@frak-labs/design-system/components/Box";
import { Button } from "@frak-labs/design-system/components/Button";
import { NumberedCircle } from "@frak-labs/design-system/components/NumberedCircle";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import {
    CardBackground,
    CheckIcon,
    CopyIcon,
    LogoFrakWithName,
    ShareIcon,
} from "@frak-labs/design-system/icons";
import { Minus, Plus } from "lucide-react";
import { Toaster } from "sonner";
import { MerchantLogo } from "../MerchantLogo";
import { PostShareConfirmation } from "../PostShareConfirmation";
import { overlay } from "../shared.css";
import * as styles from "./sharingPage.css";

export type SharingPageProps = {
    /**
     * The merchant app name displayed in the header.
     */
    appName: string;
    /**
     * The merchant logo URL displayed in the header.
     */
    logoUrl?: string;
    /**
     * Products to display in the sharing page.
     */
    products: SharingPageProduct[];
    /**
     * The computed sharing link (with Frak context encoded).
     * When null, share/copy buttons are disabled.
     */
    sharingLink: string | null;
    /**
     * The install URL for the wallet app.
     * Shown on the PostShareConfirmation screen.
     */
    installUrl: string | null;
    /**
     * Translation function — each consumer provides their own.
     * Listener: cloned i18n with merchant overrides.
     * Wallet: plain useTranslation().
     */
    t: (key: string, options?: Record<string, unknown>) => string;
    /**
     * Whether a share action is currently in progress (pending navigator.share).
     */
    isSharing: boolean;
    /**
     * Whether the Web Share API is available in the current browser.
     * When false, the share button is hidden and copy is the only option.
     */
    canShare?: boolean;
    /**
     * Whether to show the post-share confirmation screen.
     */
    showConfirmation: boolean;
    /**
     * Called when the user clicks the "Share" button.
     */
    onShare: () => void;
    /**
     * Called when the user clicks the "Copy" button.
     */
    onCopy: () => void;
    /**
     * Called when the user clicks the "Later" / dismiss button.
     */
    onDismiss: () => void;
    /**
     * Called when the user clicks "Share again" on the confirmation screen.
     */
    onShareAgain: () => void;
    /**
     * Called when the user clicks the install CTA on the confirmation screen.
     * Listener: emitLifecycleEvent (iframe→parent redirect).
     * Wallet: navigate to /install route.
     */
    onInstall: () => void;
    /**
     * Called when the user dismisses the confirmation screen.
     */
    onConfirmationDismiss: () => void;
    /**
     * Index of the currently selected product.
     * Defaults to 0 (first product) when products are present.
     */
    selectedProductIndex?: number;
    /**
     * Called when the user selects a different product.
     */
    onProductSelect?: (index: number) => void;
};

export function SharingPage({
    appName,
    logoUrl,
    products,
    selectedProductIndex,
    onProductSelect,
    sharingLink,
    installUrl,
    t,
    isSharing,
    canShare = true,
    showConfirmation,
    onShare,
    onCopy,
    onDismiss,
    onShareAgain,
    onInstall,
    onConfirmationDismiss,
}: SharingPageProps) {
    const effectiveSelectedIndex =
        products.length > 0 ? (selectedProductIndex ?? 0) : undefined;
    if (showConfirmation) {
        return (
            <PostShareConfirmation
                installUrl={installUrl}
                appName={appName}
                logoUrl={logoUrl}
                t={t}
                onDismiss={onConfirmationDismiss}
                onShareAgain={onShareAgain}
                onInstall={onInstall}
            />
        );
    }

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
                <Toaster position="top-center" />

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
                    <Button
                        variant="ghost"
                        size="none"
                        width="auto"
                        className={styles.dismissButton}
                        onClick={onDismiss}
                    >
                        {t("sdk.sharingPage.dismiss")}
                    </Button>
                </header>

                <main className={styles.main}>
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
                                <MerchantLogo
                                    src={logoUrl}
                                    alt={appName}
                                    className={styles.creditCardLogo}
                                />
                            </div>
                        </div>
                    </section>

                    <section className={styles.rewardCard}>
                        <Text as="h2" variant="heading2">
                            {t("sdk.sharingPage.reward.title")}
                        </Text>
                        <Text variant="bodySmall" color="secondary">
                            {t("sdk.sharingPage.reward.tagline")}
                        </Text>
                    </section>

                    {products.length > 0 && (
                        <Stack as="section" space="s">
                            {products.map(
                                (
                                    product: SharingPageProduct,
                                    index: number
                                ) => (
                                    <ProductCard
                                        key={index}
                                        product={product}
                                        selected={
                                            effectiveSelectedIndex === index
                                        }
                                        onSelect={() =>
                                            onProductSelect?.(index)
                                        }
                                    />
                                )
                            )}
                        </Stack>
                    )}

                    <Stack as="section" space="m">
                        <ol className={styles.stepper}>
                            <li className={styles.stepItem}>
                                <NumberedCircle number={1} color="filled" />
                                <span className={styles.stepConnectorDark} />
                                <Stack space="xxs">
                                    <Text variant="bodySmall" weight="semiBold">
                                        {
                                            splitStep(
                                                t("sdk.sharingPage.steps.1")
                                            ).title
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
                                            splitStep(
                                                t("sdk.sharingPage.steps.2")
                                            ).title
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
                                            splitStep(
                                                t("sdk.sharingPage.steps.3")
                                            ).title
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

                    <Stack as="section" space="m" className={styles.faqWrapper}>
                        <Text
                            as="h3"
                            variant="heading3"
                            className={styles.faqTitle}
                        >
                            {t("sdk.sharingPage.faq.title")}
                        </Text>
                        <Accordion
                            type="single"
                            collapsible
                            className={styles.faqList}
                        >
                            {[1, 2, 3, 4, 5].map((i) => (
                                <AccordionItem
                                    key={`faq-${i}`}
                                    value={`faq-${i}`}
                                    className={styles.faqItem}
                                >
                                    <AccordionTrigger
                                        className={styles.faqTrigger}
                                    >
                                        {t(`sdk.sharingPage.faq.q${i}`)}
                                        <Plus
                                            size={20}
                                            className={`${styles.faqIcon} ${styles.faqIconPlus}`}
                                        />
                                        <Minus
                                            size={20}
                                            className={`${styles.faqIcon} ${styles.faqIconMinus}`}
                                        />
                                    </AccordionTrigger>
                                    <AccordionContent>
                                        <div className={styles.faqContent}>
                                            {t(`sdk.sharingPage.faq.a${i}`)}
                                        </div>
                                    </AccordionContent>
                                </AccordionItem>
                            ))}
                        </Accordion>
                    </Stack>

                    <nav className={styles.legalLinks}>
                        <a
                            href="https://frak.id/support"
                            target="_blank"
                            rel="noopener noreferrer"
                            className={styles.legalLink}
                        >
                            {t("sdk.sharingPage.legal.help")}
                        </a>
                        <a
                            href="https://frak.id/privacy"
                            target="_blank"
                            rel="noopener noreferrer"
                            className={styles.legalLink}
                        >
                            {t("sdk.sharingPage.legal.privacy")}
                        </a>
                        <a
                            href="https://frak.id/terms"
                            target="_blank"
                            rel="noopener noreferrer"
                            className={styles.legalLink}
                        >
                            {t("sdk.sharingPage.legal.terms")}
                        </a>
                    </nav>
                </main>

                <footer className={styles.footer}>
                    {canShare && (
                        <Button
                            variant="primary"
                            size="large"
                            fontSize="s"
                            onClick={onShare}
                            disabled={isSharing || !sharingLink}
                            className={styles.shareButton}
                        >
                            {t("sharing.btn.share")}
                            <ShareIcon width={16} height={16} />
                        </Button>
                    )}
                    <Button
                        variant="secondary"
                        size="large"
                        fontSize="s"
                        onClick={onCopy}
                        disabled={!sharingLink}
                        className={styles.copyButton}
                    >
                        {t("sharing.btn.copy")}
                        <CopyIcon width={16} height={16} />
                    </Button>
                </footer>
            </div>
        </div>
    );
}

function ProductCard({
    product,
    selected,
    onSelect,
}: {
    product: SharingPageProduct;
    selected: boolean;
    onSelect: () => void;
}) {
    return (
        <button type="button" className={styles.productCard} onClick={onSelect}>
            <span
                className={
                    selected ? styles.checkIcon : styles.checkIconUnselected
                }
            >
                {selected && <CheckIcon width={20} height={20} />}
            </span>
            {product.imageUrl && (
                <img
                    src={product.imageUrl}
                    alt={product.title}
                    className={styles.productImage}
                />
            )}
            <Text variant="bodySmall" weight="medium">
                {product.title}
            </Text>
        </button>
    );
}
