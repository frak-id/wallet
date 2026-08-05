import type { RewardAmountParts } from "@frak-labs/core-sdk/rewards";
import { Skeleton } from "@frak-labs/design-system/components/Skeleton";
import { CardBackground } from "@frak-labs/design-system/icons";
import { MerchantLogo } from "../MerchantLogo";
import * as styles from "./sharingPage.css";
import type { SharingMerchant, SharingReward, SharingT } from "./types";

/**
 * The hero "credit card": the headline reward, its tagline, and the merchant
 * logo. Owns the reward-loading skeletons and the tiered / product-scoped copy
 * variants.
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
 * Render the credit-card headline amount, styling the trailing unit (currency
 * symbol or `%`) smaller than the integer.
 *
 * Takes `parts` when the reward query produced them, which is the normal path
 * and needs no parsing at all.
 *
 * `amount` is the fallback, and it is not vestigial: a native host seeds a
 * cached headline through the `seedReward` URL param so the card paints on the
 * first frame, before any query resolves. That value is a bare string with
 * nothing structured behind it — and it is attacker-controllable, which is why
 * teaching the sanitiser to emit parts would be the wrong trade. When it is
 * what we have, it is printed whole: one frame without small-caps decimals,
 * replaced the moment the real reward lands.
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
