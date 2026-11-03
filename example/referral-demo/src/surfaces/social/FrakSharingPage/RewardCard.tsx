import { CardBackground } from "@frak-labs/design-system/icons";
import { MaisonLuneLogo } from "@/art";
import { campaign } from "@/data/rewards";
import { useLang, useT } from "@/i18n";
import { useFormatMoney } from "@/i18n/format";
import { sharingMessages } from "../messages";
import * as styles from "./sharingPage.css";

/** Headline amount with the currency drawn smaller, on whichever side the locale puts it. */
function CardAmount() {
    const lang = useLang();
    const integer = String(campaign.referrerReward);
    const unit = <span className={styles.creditCardCurrency}>€</span>;
    return (
        <span className={styles.creditCardAmount}>
            {lang === "en" && unit}
            {integer}
            {lang === "fr" && unit}
        </span>
    );
}

/** The hero "credit card": reward, tagline and merchant logo. */
export function RewardCard() {
    const t = useT(sharingMessages);
    const money = useFormatMoney();
    return (
        <section className={styles.creditCard}>
            <CardBackground className={styles.creditCardBg} />
            <div className={styles.creditCardContent}>
                <div className={styles.creditCardTop}>
                    <CardAmount />
                    <span className={styles.creditCardLabel}>
                        {t("cardLabel")}
                    </span>
                </div>
                <div className={styles.creditCardBottom}>
                    <span className={styles.creditCardBottomText}>
                        {t("cardTagline1", {
                            reward: money(campaign.referrerReward, "reward"),
                        })}
                        <br />
                        {t("cardTagline2")}
                    </span>
                    <span className={styles.creditCardLogo}>
                        <MaisonLuneLogo variant="monogram" />
                    </span>
                </div>
            </div>
        </section>
    );
}
