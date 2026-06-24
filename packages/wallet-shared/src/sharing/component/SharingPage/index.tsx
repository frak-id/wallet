import type { EstimatedReward, SharingPageProduct } from "@frak-labs/core-sdk";
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@frak-labs/design-system/components/Accordion";
import { Box } from "@frak-labs/design-system/components/Box";
import { Button } from "@frak-labs/design-system/components/Button";
import { NumberedCircle } from "@frak-labs/design-system/components/NumberedCircle";
import { Skeleton } from "@frak-labs/design-system/components/Skeleton";
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
import { ExternalLink } from "../../../common/component/ExternalLink";
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
     * Whether the estimated reward query is still loading.
     * While true, the reward amount and tagline are replaced by a skeleton so
     * the card never flashes a placeholder "0" before the real amount resolves.
     */
    isRewardLoading?: boolean;
    /**
     * Payout type of the displayed reward. Drives reward-specific presentation
     * on the credit card: tiered rewards get an "Up to" prefix and a matching
     * tagline variant.
     */
    rewardType?: EstimatedReward["payoutType"];
    /**
     * Minimum purchase amount gating the reward, already formatted with the
     * merchant currency (e.g. `"10 €"`). When set, step 2 mentions the minimum
     * order value required to earn.
     */
    minPurchaseAmount?: string;
    /**
     * Whole-day lockup applied before a reward settles. When set, step 3 adds a
     * line stating when earnings become available.
     */
    lockupDurationDays?: number;
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
    isRewardLoading = false,
    rewardType,
    minPurchaseAmount,
    lockupDurationDays,
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
    const isTiered = rewardType === "tiered";
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

    const step1 = splitStep(t("sdk.sharingPage.steps.1"));
    // Mention the minimum order value in step 2 when the campaign gates on one.
    const step2 = splitStep(
        t(
            "sdk.sharingPage.steps.2",
            minPurchaseAmount
                ? { context: "min", minAmount: minPurchaseAmount }
                : undefined
        )
    );
    const step3 = splitStep(t("sdk.sharingPage.steps.3"));
    // Extra step 3 line stating when locked earnings become available.
    const lockupNote =
        lockupDurationDays != null
            ? t("sdk.sharingPage.steps.3_lockup", {
                  lockupInDay: lockupDurationDays,
              })
            : undefined;

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
                        <LogoFrakWithName className={styles.logo} />
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
                                <div className={styles.creditCardAmountColumn}>
                                    {isTiered && !isRewardLoading && (
                                        <span className={styles.creditCardUpTo}>
                                            {t("sdk.sharingPage.card.upTo")}
                                        </span>
                                    )}
                                    <span className={styles.creditCardAmount}>
                                        {isRewardLoading ? (
                                            <Skeleton
                                                variant="rect"
                                                width={90}
                                                height={36}
                                            />
                                        ) : (
                                            <CreditCardAmount
                                                amount={t(
                                                    "sdk.sharingPage.card.amount"
                                                )}
                                            />
                                        )}
                                    </span>
                                </div>
                                <span className={styles.creditCardLabel}>
                                    {t("sdk.sharingPage.card.label")}
                                </span>
                            </div>
                            <div className={styles.creditCardBottom}>
                                <span className={styles.creditCardBottomText}>
                                    {isRewardLoading ? (
                                        <Skeleton
                                            variant="text"
                                            width={70}
                                            height={14}
                                        />
                                    ) : (
                                        t(
                                            "sdk.sharingPage.card.tagline1",
                                            isTiered
                                                ? { context: "tiered" }
                                                : undefined
                                        )
                                    )}
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
                            <Step
                                number={1}
                                connector="dark"
                                title={step1.title}
                                descriptions={[step1.description]}
                            />
                            <Step
                                number={2}
                                connector="default"
                                title={step2.title}
                                descriptions={[step2.description]}
                            />
                            <Step
                                number={3}
                                title={step3.title}
                                descriptions={[step3.description, lockupNote]}
                            />
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
                        <ExternalLink
                            href="https://frak.id/support"
                            className={styles.legalLink}
                        >
                            {t("sdk.sharingPage.legal.help")}
                        </ExternalLink>
                        <ExternalLink
                            href="https://frak.id/privacy"
                            className={styles.legalLink}
                        >
                            {t("sdk.sharingPage.legal.privacy")}
                        </ExternalLink>
                        <ExternalLink
                            href="https://frak.id/terms"
                            className={styles.legalLink}
                        >
                            {t("sdk.sharingPage.legal.terms")}
                        </ExternalLink>
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

/**
 * Render the credit-card headline amount, styling the trailing symbol (currency
 * or `%`) like a unit. Percentage rewards (e.g. `"10 %"`) get the `%` styled as
 * a currency symbol with no forced decimals; fiat amounts split off their
 * decimals + currency into the smaller currency style.
 */
function CreditCardAmount({ amount }: { amount: string }) {
    const percentMatch = amount.match(/^([\d\s]+)\s*%$/);
    if (percentMatch) {
        return (
            <>
                {percentMatch[1].trim()}
                <span className={styles.creditCardCurrency}>%</span>
            </>
        );
    }

    const match = amount.match(/^([\d\s]+)([.,]\d+)?\s*(.*)$/);
    if (!match) return <>{amount}</>;
    const integer = match[1].trim();
    const decimals = match[2] ?? ",00";
    const currency = match[3] ?? "";
    return (
        <>
            {integer}
            <span className={styles.creditCardCurrency}>
                {decimals}
                {currency}
            </span>
        </>
    );
}

/**
 * One numbered "how it works" step: a title plus zero or more description lines
 * (falsy lines are skipped, so optional copy can be passed straight through).
 */
function Step({
    number,
    connector,
    title,
    descriptions,
}: {
    number: number;
    connector?: "default" | "dark";
    title: string;
    descriptions: (string | undefined)[];
}) {
    return (
        <li className={styles.stepItem}>
            <NumberedCircle number={number} color="filled" />
            {connector === "dark" && (
                <span className={styles.stepConnectorDark} />
            )}
            {connector === "default" && (
                <span className={styles.stepConnector} />
            )}
            <Stack space="xxs">
                <Text variant="bodySmall" weight="semiBold">
                    {title}
                </Text>
                {descriptions
                    .filter((line): line is string => Boolean(line))
                    .map((line) => (
                        <Text
                            key={line}
                            variant="bodySmall"
                            className={styles.stepDescription}
                        >
                            {line}
                        </Text>
                    ))}
            </Stack>
        </li>
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
