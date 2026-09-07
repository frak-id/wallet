import type { RewardAmountParts } from "@frak-labs/core-sdk/rewards";
import { Skeleton } from "@frak-labs/design-system/components/Skeleton";
import { CardBackground } from "@frak-labs/design-system/icons";
import { MerchantLogo } from "../MerchantLogo";
import * as styles from "./sharingPage.css";
import type { SharingMerchant, SharingReward, SharingT } from "./types";

/**
 * The hero "credit card": headline reward, tagline and merchant logo, with the
 * loading skeletons and the tiered / product-scoped copy variants.
 */
export function RewardCard({
    merchant,
    reward,
    t,
}: {
    merchant: SharingMerchant;
    reward: SharingReward;
    t: SharingT;
}) {
    const isLoading = reward.status === "loading";
    const isTiered =
        reward.status === "ready" && reward.payoutType === "tiered";
    const isProductScoped =
        reward.status === "ready" && reward.isProductScoped === true;

    return (
        <section className={styles.creditCard}>
            <CardBackground className={styles.creditCardBg} />
            <div className={styles.creditCardContent}>
                <div className={styles.creditCardTop}>
                    <div className={styles.creditCardAmountColumn}>
                        {isTiered && !isLoading && (
                            <span className={styles.creditCardUpTo}>
                                {t("sdk.sharingPage.card.upTo")}
                            </span>
                        )}
                        <span className={styles.creditCardAmount}>
                            {isLoading ? (
                                <Skeleton
                                    variant="rect"
                                    width={90}
                                    height={36}
                                />
                            ) : (
                                <CreditCardAmount
                                    amount={t("sdk.sharingPage.card.amount")}
                                    parts={
                                        reward.status === "ready"
                                            ? reward.parts
                                            : undefined
                                    }
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
                        <CardTagline
                            isRewardLoading={isLoading}
                            text={t(
                                "sdk.sharingPage.card.tagline1",
                                isTiered ? { context: "tiered" } : undefined
                            )}
                        />
                        <br />
                        <CardTagline
                            isRewardLoading={isLoading}
                            text={t(
                                "sdk.sharingPage.card.tagline2",
                                isProductScoped
                                    ? { context: "product" }
                                    : undefined
                            )}
                        />
                    </span>
                    <MerchantLogo
                        src={merchant.logoUrl}
                        alt={merchant.name}
                        className={styles.creditCardLogo}
                    />
                </div>
            </div>
        </section>
    );
}

/** A single credit-card tagline line, skeletonized while the reward loads. */
function CardTagline({
    isRewardLoading,
    text,
}: {
    isRewardLoading: boolean;
    text: string;
}) {
    if (isRewardLoading) {
        return <Skeleton variant="text" width={70} height={14} />;
    }
    return <>{text}</>;
}

/**
 * Render the headline amount, styling the trailing unit (currency symbol or `%`)
 * smaller than the integer. `amount` is the fallback for a host-seeded headline,
 * which has no `parts` behind it and is URL-supplied (attacker-controllable), so
 * it is printed whole rather than parsed.
 */
export function CreditCardAmount({
    amount,
    parts,
}: {
    amount: string;
    parts?: RewardAmountParts;
}) {
    if (!parts) return <>{amount}</>;

    if (parts.unitPosition === "prefix") {
        return (
            <>
                <span className={styles.creditCardCurrency}>{parts.unit}</span>
                {parts.integer}
                {parts.decimals && (
                    <span className={styles.creditCardCurrency}>
                        {parts.decimals}
                    </span>
                )}
            </>
        );
    }

    return (
        <>
            {parts.integer}
            <span className={styles.creditCardCurrency}>
                {parts.decimals}
                {parts.unit}
            </span>
        </>
    );
}
