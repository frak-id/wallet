import { motion } from "motion/react";
import { PersonaAvatar } from "@/art";
import { useDemoStore } from "@/core/store";
import { heroProductId, merchant, products } from "@/data/merchant";
import { type PersonaId, personas } from "@/data/personas";
import { campaign, clock } from "@/data/rewards";
import { useT } from "@/i18n";
import { useFormatMoney } from "@/i18n/format";
import { PhoneFrame } from "@/shell/Device";
import type { WalletPhase } from "@/surfaces/contracts";
import { WalletHome } from "@/surfaces/wallet";
import * as styles from "./finale.css";
import { stageMessages } from "./messages";

const cast: { persona: PersonaId; phase: WalletPhase; amount: number }[] = [
    {
        persona: "lea",
        phase: "referrer-transferred",
        amount: campaign.referrerReward,
    },
    {
        persona: "chloe",
        phase: "referee-earned",
        amount: campaign.refereeReward,
    },
];

function FinalePhone({
    persona,
    phase,
    maxScale,
}: {
    persona: PersonaId;
    phase: WalletPhase;
    maxScale?: number;
}) {
    return (
        <PhoneFrame tone="dark" time={clock.chloe} maxScale={maxScale}>
            <div className={styles.appScreen}>
                <WalletHome persona={persona} phase={phase} embedded={true} />
            </div>
        </PhoneFrame>
    );
}

function PhoneCaption({
    persona,
    amount,
}: {
    persona: PersonaId;
    amount: number;
}) {
    const t = useT(stageMessages);
    const money = useFormatMoney();
    return (
        <div className={styles.phoneCaption}>
            <PersonaAvatar persona={persona} size={26} />
            <span>{personas[persona].firstName}</span>
            <span className={styles.earned}>
                {t("finale.earned", { amount: money(amount, "reward") })}
            </span>
        </div>
    );
}

function MerchantSummary() {
    const t = useT(stageMessages);
    const money = useFormatMoney();
    const rows = [
        { label: t("finale.merchant.customer"), value: "+1" },
        {
            label: t("finale.merchant.revenue"),
            value: money(products[heroProductId].price),
        },
        {
            label: t("finale.merchant.cost"),
            value: money(
                campaign.referrerReward + campaign.refereeReward,
                "reward"
            ),
        },
    ];
    return (
        <div className={styles.summary}>
            <span className={styles.summaryTitle}>
                {t("finale.merchant.title", { merchant: merchant.name })}
            </span>
            {rows.map((row) => (
                <div key={row.label} className={styles.summaryRow}>
                    <span>{row.label}</span>
                    <strong>{row.value}</strong>
                </div>
            ))}
            <span className={styles.summaryFootnote}>
                {t("finale.merchant.roi")}
            </span>
        </div>
    );
}

function Heading() {
    const t = useT(stageMessages);
    return (
        <motion.header
            className={styles.heading}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
        >
            <span className={styles.overline}>{t("finale.overline")}</span>
            <h1 className={styles.title}>{t("finale.title")}</h1>
            <p className={styles.lede}>{t("finale.lede")}</p>
        </motion.header>
    );
}

function ReplayButton() {
    const t = useT(stageMessages);
    const restart = useDemoStore((s) => s.restart);
    return (
        <button type="button" className={styles.replay} onClick={restart}>
            ↺ {t("finale.replay")}
        </button>
    );
}

/** Finale on a real phone: both wallets shrunk side by side. */
export function Finale() {
    return (
        <div className={styles.screen}>
            <Heading />
            <div className={styles.phonesRow}>
                {cast.map(({ persona, phase, amount }) => (
                    <div key={persona} className={styles.miniColumn}>
                        <div className={styles.miniPhone}>
                            <FinalePhone persona={persona} phase={phase} />
                        </div>
                        <PhoneCaption persona={persona} amount={amount} />
                    </div>
                ))}
            </div>
            <MerchantSummary />
            <ReplayButton />
        </div>
    );
}

/** Finale on a big screen: the single phone splits into both personas' phones. */
export function DeskFinale() {
    const [lea, chloe] = cast;
    if (!lea || !chloe) return null;
    return (
        <div className={styles.desk}>
            <Heading />
            <div className={styles.deskRow}>
                <motion.div
                    className={styles.deskColumn}
                    initial={{ opacity: 0, x: 80 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.5, ease: [0.32, 0.72, 0, 1] }}
                >
                    <div className={styles.deskPhone}>
                        <FinalePhone persona={lea.persona} phase={lea.phase} />
                    </div>
                    <PhoneCaption persona={lea.persona} amount={lea.amount} />
                </motion.div>
                <motion.div
                    className={styles.deskCenter}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.5 }}
                >
                    <MerchantSummary />
                    <ReplayButton />
                </motion.div>
                <motion.div
                    className={styles.deskColumn}
                    initial={{ opacity: 0, x: -80 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.5, ease: [0.32, 0.72, 0, 1] }}
                >
                    <div className={styles.deskPhone}>
                        <FinalePhone
                            persona={chloe.persona}
                            phase={chloe.phase}
                        />
                    </div>
                    <PhoneCaption
                        persona={chloe.persona}
                        amount={chloe.amount}
                    />
                </motion.div>
            </div>
        </div>
    );
}
