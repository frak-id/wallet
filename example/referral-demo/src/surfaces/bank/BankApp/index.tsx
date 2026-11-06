import { animate, motion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { PersonaAvatar } from "@/art";
import { bank, bankHistory } from "@/data/bank";
import { personas } from "@/data/personas";
import { campaign } from "@/data/rewards";
import { useLang, useT } from "@/i18n";
import { useFormatMoney } from "@/i18n/format";
import { useDelayedFlag } from "@/shell/useDelayedFlag";
import type { BankAppProps } from "@/surfaces/contracts";
import { HeliaMark } from "../HeliaMark";
import { bankMessages } from "../messages";
import * as styles from "./bankApp.css";
import { dayLabel, maskIban } from "./format";
import { glyphs } from "./glyphs";
import {
    FreshTransactionRow,
    type Transaction,
    TransactionRow,
} from "./TransactionRow";

const TRANSFER_LANDS_MS = 900;

const transferRow: Transaction = {
    label: bank.senderName,
    detail: "transfer",
    amount: campaign.referrerReward,
    daysAgo: 0,
};

/** Shows `value`, counting up to it whenever it changes after mount. */
function useCountUp(value: number) {
    const [display, setDisplay] = useState(value);
    const shown = useRef(value);

    useEffect(() => {
        if (shown.current === value) return;
        const controls = animate(shown.current, value, {
            duration: 1.4,
            ease: [0.16, 1, 0.3, 1],
            onUpdate: (latest) => {
                shown.current = latest;
                setDisplay(latest);
            },
        });
        return () => controls.stop();
    }, [value]);

    return display;
}

function AccountCard({ landed }: { landed: boolean }) {
    const t = useT(bankMessages);
    const money = useFormatMoney();
    const balance = useCountUp(
        landed ? bank.balance + campaign.referrerReward : bank.balance
    );

    return (
        <section className={styles.card}>
            <div className={styles.cardTop}>
                <span className={styles.cardBrand}>
                    <HeliaMark size={30} />
                    {bank.name}
                </span>
                <span className={styles.cardAccount}>{t("account")}</span>
            </div>
            <div className={styles.cardBalanceLabel}>
                {t("balance")}
                <motion.span
                    className={styles.creditChip}
                    aria-hidden={!landed}
                    initial={false}
                    animate={
                        landed
                            ? { opacity: 1, y: 0, scale: 1 }
                            : { opacity: 0, y: 6, scale: 0.9 }
                    }
                    transition={{ type: "spring", damping: 18 }}
                >
                    +{money(campaign.referrerReward)}
                </motion.span>
            </div>
            <span className={styles.cardBalance}>{money(balance)}</span>
            <div className={styles.cardBottom}>
                <span>{bank.holder}</span>
                <span className={styles.cardIban}>{maskIban(bank.iban)}</span>
            </div>
        </section>
    );
}

function QuickActions() {
    const t = useT(bankMessages);
    const actions = [
        {
            key: "transfer",
            label: t("action.transfer"),
            glyph: glyphs.transfer,
        },
        { key: "topUp", label: t("action.topUp"), glyph: glyphs.topUp },
        { key: "details", label: t("action.details"), glyph: glyphs.details },
        { key: "more", label: t("action.more"), glyph: glyphs.more },
    ];
    return (
        <div className={styles.actions}>
            {actions.map((action) => (
                <span key={action.key} className={styles.action}>
                    <span className={styles.actionIcon}>{action.glyph}</span>
                    {action.label}
                </span>
            ))}
        </div>
    );
}

function Transactions({ landed }: { landed: boolean }) {
    const t = useT(bankMessages);
    const lang = useLang();
    const groups = useMemo(() => {
        const today = new Date();
        const byDay = new Map<number, Transaction[]>();
        for (const row of bankHistory) {
            byDay.set(row.daysAgo, [...(byDay.get(row.daysAgo) ?? []), row]);
        }
        return [...byDay].map(([daysAgo, rows]) => ({
            daysAgo,
            label: dayLabel(daysAgo, lang, today),
            rows,
        }));
    }, [lang]);

    return (
        <section>
            <div className={styles.sectionHeader}>
                <h2 className={styles.sectionTitle}>{t("transactions")}</h2>
                <span className={styles.seeAll}>{t("seeAll")}</span>
            </div>
            {groups.map((group) => (
                <div key={group.daysAgo} className={styles.group}>
                    <h3 className={styles.groupLabel}>{group.label}</h3>
                    <div className={styles.groupCard}>
                        {group.daysAgo === 0 && (
                            <FreshTransactionRow
                                row={transferRow}
                                landed={landed}
                            />
                        )}
                        {group.rows.map((row) => (
                            <TransactionRow key={row.label} row={row} />
                        ))}
                    </div>
                </div>
            ))}
        </section>
    );
}

function TabBar() {
    const t = useT(bankMessages);
    const tabs = [
        { key: "home", label: t("tab.home"), glyph: glyphs.home },
        { key: "cards", label: t("tab.cards"), glyph: glyphs.cards },
        { key: "payments", label: t("tab.payments"), glyph: glyphs.payments },
        { key: "budget", label: t("tab.budget"), glyph: glyphs.budget },
        { key: "profile", label: t("tab.profile"), glyph: glyphs.profile },
    ];
    return (
        <nav className={styles.tabBar}>
            {tabs.map((tab) => (
                <span
                    key={tab.key}
                    className={styles.tab({ active: tab.key === "home" })}
                >
                    {tab.glyph}
                    {tab.label}
                </span>
            ))}
        </nav>
    );
}

/** Léa's bank, Hélia: the Frak transfer lands on top of her statement and her balance counts up. */
export function BankApp({ persona }: BankAppProps) {
    const t = useT(bankMessages);
    const landed = useDelayedFlag(TRANSFER_LANDS_MS);

    return (
        <div className={styles.screen}>
            <div className={styles.scroll}>
                <header className={styles.header}>
                    <PersonaAvatar persona={persona} size={40} />
                    <h1 className={styles.greeting}>
                        {t("greeting", { name: personas[persona].firstName })}
                    </h1>
                    <span className={styles.headerButton}>{glyphs.search}</span>
                    <span className={styles.headerButton}>
                        {glyphs.bell}
                        <span className={styles.bellDot} />
                    </span>
                </header>
                <AccountCard landed={landed} />
                <QuickActions />
                <Transactions landed={landed} />
            </div>
            <TabBar />
        </div>
    );
}
