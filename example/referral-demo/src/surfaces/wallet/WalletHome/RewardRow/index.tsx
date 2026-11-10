import { Badge } from "@frak-labs/design-system/components/Badge";
import { Inline } from "@frak-labs/design-system/components/Inline";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import {
    ClockHandsIcon,
    GiftIcon,
    HourglassIcon,
} from "@frak-labs/design-system/icons";
import { vars } from "@frak-labs/design-system/theme";
import { AnimatePresence, motion } from "motion/react";
import { merchant } from "@/data/merchant";
import { useT } from "@/i18n";
import { useFormatMoney } from "@/i18n/format";
import { MerchantLogo } from "../../components/MerchantLogo";
import { walletMessages } from "../../messages";
import type { PhaseReward, RewardStatus, RewardTag } from "../phases";
import * as styles from "./rewardRow.css";

function TagBadge({ tag }: { tag: RewardTag }) {
    const t = useT(walletMessages);
    switch (tag.kind) {
        case "welcomeBonus":
            return (
                <Badge variant="success" size="small">
                    {t("history.welcomeBonus")}
                </Badge>
            );
        case "referralOf":
            return (
                <Badge variant="info" size="small">
                    {t("history.referralOf", { name: tag.name })}
                </Badge>
            );
    }
}

function StatusBadge({
    status,
    tag,
}: {
    status: RewardStatus;
    tag: RewardTag;
}) {
    if (tag.kind === "welcomeBonus") {
        return (
            <span className={styles.badge}>
                <span className={styles.badgeInner({ status: "bonus" })}>
                    <GiftIcon
                        color={vars.surface.background}
                        width={12}
                        height={12}
                    />
                </span>
            </span>
        );
    }
    if (status === "consumed") return null;
    return (
        <span className={styles.badge}>
            <span className={styles.badgeInner({ status })}>
                <ClockHandsIcon
                    color={vars.surface.background}
                    width={12}
                    height={12}
                />
            </span>
        </span>
    );
}

function DisplayAmount({
    amount,
    status,
}: {
    amount: string;
    status: RewardStatus;
}) {
    return (
        <Inline space="xxs" alignY="center" wrap={false}>
            {status === "settled" && (
                <HourglassIcon color={vars.text.secondary} />
            )}
            <Text
                variant="bodySmall"
                color={status === "consumed" ? "success" : "disabled"}
            >
                {amount}
            </Text>
        </Inline>
    );
}

/** One line of the earnings history, as `RewardHistoryItem` draws it. */
export function RewardRow({
    reward,
    status,
    animated,
}: {
    reward: PhaseReward;
    status: RewardStatus;
    /** Plays the arrival highlight, replayed whenever `status` changes. */
    animated: boolean;
}) {
    const t = useT(walletMessages);
    const money = useFormatMoney();

    return (
        <motion.button
            type="button"
            className={styles.row}
            initial={animated ? { opacity: 0, y: 14 } : false}
            animate={{ opacity: 1, y: 0 }}
            transition={{
                delay: 0.35,
                duration: 0.45,
                ease: [0.16, 1, 0.3, 1],
            }}
        >
            <AnimatePresence>
                {animated && (
                    <motion.span
                        key={status}
                        className={styles.highlight({
                            tone: status === "consumed" ? "success" : "action",
                        })}
                        initial={{ opacity: 1 }}
                        animate={{ opacity: 0 }}
                        transition={{
                            delay: 1.4,
                            duration: 1.4,
                            ease: "easeOut",
                        }}
                    />
                )}
            </AnimatePresence>
            <Inline space="m" padding="m" fill className={styles.content}>
                <span className={styles.logoWrapper}>
                    <MerchantLogo size="small" />
                    <StatusBadge status={status} tag={reward.tag} />
                </span>
                <Inline space="m" align="space-between" fill wrap={false}>
                    <Stack space="xxs" className={styles.info}>
                        <Inline space="xs" alignY="center">
                            <Text variant="body" weight="medium">
                                {merchant.name}
                            </Text>
                            <TagBadge tag={reward.tag} />
                        </Inline>
                        <Stack space="none">
                            <Text variant="bodySmall" color="secondary">
                                {`${t("common.today")}, ${reward.time}`}
                            </Text>
                            {status !== "consumed" && (
                                <Text
                                    variant="bodySmall"
                                    color="secondary"
                                    className={styles.statusText}
                                >
                                    {t(`history.status.${status}`)}
                                </Text>
                            )}
                        </Stack>
                    </Stack>
                    <span className={styles.amount}>
                        <DisplayAmount
                            amount={`+${money(reward.amount)}`}
                            status={status}
                        />
                    </span>
                </Inline>
            </Inline>
        </motion.button>
    );
}
