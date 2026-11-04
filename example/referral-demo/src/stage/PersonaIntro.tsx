import { LogoFrakWithName } from "@frak-labs/design-system/icons";
import { motion } from "motion/react";
import { PersonaAvatar } from "@/art";
import { useDemoNav } from "@/core/store";
import { type PersonaId, personas } from "@/data/personas";
import { campaign } from "@/data/rewards";
import { useLang, useT } from "@/i18n";
import { useFormatMoney } from "@/i18n/format";
import { LangToggle } from "./Launcher";
import { stageMessages } from "./messages";
import * as styles from "./stage.css";

const STEPS = [1, 2, 3] as const;

/** Introduces whose phone the audience is about to watch. */
export function PersonaIntro({ persona }: { persona: PersonaId }) {
    const t = useT(stageMessages);
    const lang = useLang();
    const money = useFormatMoney();
    const { next } = useDemoNav();
    const { firstName, lastName, role } = personas[persona];
    const scenario = persona === "lea" ? "referrer" : "referee";

    return (
        <div className={styles.screen}>
            <div className={styles.topBar}>
                <LogoFrakWithName width={68} height={26} />
                <LangToggle />
            </div>

            <div className={styles.introBody}>
                <span className={styles.overline}>
                    {t(`intro.${scenario}.overline`)}
                </span>
                <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: "spring", damping: 16, delay: 0.1 }}
                >
                    <PersonaAvatar persona={persona} size={112} ring="story" />
                </motion.div>
                <h1 className={styles.name}>
                    {firstName} {lastName}
                </h1>
                <span className={styles.roleChip}>{role[lang]}</span>
                <p className={styles.story}>{t(`intro.${scenario}.story`)}</p>

                <ol className={styles.journey}>
                    {STEPS.map((index) => (
                        <motion.li
                            key={index}
                            className={styles.journeyItem}
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.25 + index * 0.1 }}
                        >
                            <span className={styles.journeyIndex}>{index}</span>
                            {t(`intro.${scenario}.step${index}`, {
                                reward: money(campaign.refereeReward, "reward"),
                            })}
                        </motion.li>
                    ))}
                </ol>
            </div>

            <button
                type="button"
                className={styles.primaryButton}
                onClick={next}
            >
                {t("intro.start")}
            </button>
        </div>
    );
}
