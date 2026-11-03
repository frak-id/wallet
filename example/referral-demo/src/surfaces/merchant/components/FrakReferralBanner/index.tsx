import { LogoFrakWithName } from "@frak-labs/design-system/icons";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { campaign } from "@/data/rewards";
import { useFormatMoney } from "@/i18n/format";
import { useDelayedFlag } from "@/shell/useDelayedFlag";
import { useMerchantT } from "../format";
import { FrakGiftIllustration } from "../icons";
import * as styles from "./frakReferralBanner.css";

/** How long the SDK takes to resolve the referral before the banner shows. */
const RESOLVE_DELAY_MS = 500;

/** `<frak-banner>` in referral mode, as a referred visitor sees it on the product page. */
export function FrakReferralBanner() {
    const t = useMerchantT();
    const money = useFormatMoney();
    const visible = useDelayedFlag(RESOLVE_DELAY_MS);
    const [dismissed, setDismissed] = useState(false);

    return (
        <AnimatePresence>
            {visible && !dismissed && (
                <motion.div
                    className={styles.slot}
                    initial={{ height: 0 }}
                    animate={{ height: "auto" }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.32, ease: [0.32, 0.72, 0, 1] }}
                >
                    <div className={styles.placement}>
                        <div className={styles.referral} role="alert">
                            <div className={styles.iconWrapper}>
                                <FrakGiftIllustration
                                    className={styles.iconSvg}
                                />
                            </div>
                            <div className={styles.body}>
                                <p className={styles.title}>
                                    {t("banner.title", {
                                        reward: money(
                                            campaign.refereeReward,
                                            "reward"
                                        ),
                                    })}
                                </p>
                                <p className={styles.description}>
                                    {t("banner.description")}
                                </p>
                                <button
                                    type="button"
                                    className={styles.cta}
                                    onClick={() => setDismissed(true)}
                                >
                                    {t("banner.cta")}
                                </button>
                            </div>
                            <LogoFrakWithName
                                className={styles.frakLogo}
                                width={42}
                                height={24}
                            />
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
