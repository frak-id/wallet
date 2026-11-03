import { LogoFrakWithName } from "@frak-labs/design-system/icons";
import { personas } from "@/data/personas";
import { campaign } from "@/data/rewards";
import { useFormatMoney } from "@/i18n/format";
import type { PostPurchaseCardState } from "@/surfaces/contracts";
import { useMerchantT } from "../format";
import { CheckIcon, CoinsIcon, FrakGiftIllustration } from "../icons";
import * as styles from "./frakPostPurchaseCard.css";

type CardCopy = { badge?: string; message: string; cta: string };

function useCardCopy(state: PostPurchaseCardState): CardCopy {
    const t = useMerchantT();
    const money = useFormatMoney();
    const referrerReward = money(campaign.referrerReward, "reward");
    const refereeReward = money(campaign.refereeReward, "reward");
    switch (state) {
        case "referrer-share":
            return {
                message: t("card.share.message", { reward: referrerReward }),
                cta: t("card.share.cta", { reward: referrerReward }),
            };
        case "referrer-collect":
            return {
                badge: t("card.collect.badge"),
                message: t("card.collect.message", { reward: referrerReward }),
                cta: t("card.collect.cta"),
            };
        case "referee-reward":
            return {
                badge: t("card.referee.badge", {
                    name: personas.lea.firstName,
                }),
                message: t("card.referee.message", { reward: refereeReward }),
                cta: t("card.referee.cta", { reward: refereeReward }),
            };
    }
}

/** `<frak-post-purchase>` on the thank-you page, in one of the story's three states. */
export function FrakPostPurchaseCard({
    state,
    onAction,
}: {
    state: PostPurchaseCardState;
    onAction: () => void;
}) {
    const copy = useCardCopy(state);
    const cardClass =
        state === "referrer-collect"
            ? `${styles.card} ${styles.highlighted}`
            : styles.card;

    return (
        <div className={cardClass}>
            <div className={styles.cardLayout}>
                <div className={styles.cardLeft}>
                    {copy.badge && (
                        <span className={styles.badge}>
                            {state === "referrer-collect" && (
                                <CheckIcon size={12} strokeWidth={2.6} />
                            )}
                            {copy.badge}
                        </span>
                    )}
                    <p className={styles.message}>{copy.message}</p>
                    <button
                        type="button"
                        className={styles.cta}
                        onClick={onAction}
                    >
                        {copy.cta}
                        <CoinsIcon className={styles.ctaIcon} />
                    </button>
                </div>
                <div className={styles.cardRight}>
                    <FrakGiftIllustration
                        className={styles.giftIcon}
                        width={80}
                        height={80}
                    />
                    <LogoFrakWithName
                        className={styles.frakLogo}
                        width={42}
                        height={24}
                    />
                </div>
            </div>
        </div>
    );
}
