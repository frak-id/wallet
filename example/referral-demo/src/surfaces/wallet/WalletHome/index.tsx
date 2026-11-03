import { Card } from "@frak-labs/design-system/components/Card";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import { AnimatePresence } from "motion/react";
import { useEffect, useState } from "react";
import { useT } from "@/i18n";
import { useHoldContinue } from "@/shell/ContinuePrompt/hold";
import type { WalletHomeProps, WalletPhase } from "@/surfaces/contracts";
import { walletMessages } from "../messages";
import { Balance } from "./Balance";
import { BottomTabBar } from "./BottomTabBar";
import { CollectedToast, Confetti } from "./Celebration";
import { PendingGainsCard, PendingGainsSheet } from "./PendingGains";
import { type PhaseReward, phaseRewards } from "./phases";
import { RewardRow } from "./RewardRow";
import { ShareNudge } from "./ShareNudge";
import * as styles from "./walletHome.css";

type CollectState = "pending" | "collecting" | "collected";

const SHEET_DELAY_MS = 650;
const COLLECT_MS = 1100;

/** Chloé collected her 5 € on her own wallet step, so the finale shows them banked. */
function initialCollectState(
    phase: WalletPhase,
    embedded: boolean
): CollectState {
    return embedded && phase === "referee-earned" ? "collected" : "pending";
}

function useCollect(
    reward: PhaseReward,
    phase: WalletPhase,
    embedded: boolean
) {
    const collectable = reward.status === "settled";
    const [state, setState] = useState(() =>
        initialCollectState(phase, embedded)
    );
    const [sheetOpen, setSheetOpen] = useState(false);

    useEffect(() => {
        if (embedded || !collectable) return;
        const timer = window.setTimeout(
            () => setSheetOpen(true),
            SHEET_DELAY_MS
        );
        return () => window.clearTimeout(timer);
    }, [embedded, collectable]);

    useEffect(() => {
        if (state !== "collecting") return;
        const timer = window.setTimeout(() => {
            setSheetOpen(false);
            setState("collected");
        }, COLLECT_MS);
        return () => window.clearTimeout(timer);
    }, [state]);

    return {
        state,
        collectable,
        sheetOpen,
        collect: () => setState((s) => (s === "pending" ? "collecting" : s)),
        openSheet: () => {
            if (collectable && state === "pending" && !embedded) {
                setSheetOpen(true);
            }
        },
        closeSheet: () => setSheetOpen(false),
    };
}

function EarningsSection({
    reward,
    collected,
    animated,
}: {
    reward: PhaseReward;
    collected: boolean;
    animated: boolean;
}) {
    const t = useT(walletMessages);
    return (
        <Stack space="xs">
            <Text variant="bodySmall" weight="medium" color="secondary" as="h2">
                {t("history.title")}
            </Text>
            <Card padding="none">
                <RewardRow
                    reward={reward}
                    status={collected ? "consumed" : reward.status}
                    animated={animated}
                />
            </Card>
        </Stack>
    );
}

/** The wallet home: title, balance, earnings history and the tab bar. */
export function WalletHome({ phase, embedded = false }: WalletHomeProps) {
    const t = useT(walletMessages);
    const reward = phaseRewards[phase];
    const collect = useCollect(reward, phase, embedded);
    const collected = collect.state === "collected";
    useHoldContinue(collect.sheetOpen || collect.state === "collecting");
    const pendingTitle =
        reward.tag.kind === "referralOf"
            ? t("collect.title", { name: reward.tag.name })
            : t("pendingGains.subtitle");

    return (
        <div className={styles.screen}>
            <div className={styles.scroller}>
                <Stack space="m">
                    <Text
                        as="h1"
                        variant="heading1"
                        className={styles.pageTitle}
                    >
                        {t("wallet.pageTitle")}
                    </Text>
                    <Balance
                        balance={collected ? reward.amount : 0}
                        pending={collected ? 0 : reward.amount}
                        onPendingClick={collect.openSheet}
                    />
                    {embedded && collect.collectable && !collected && (
                        <PendingGainsCard
                            title={pendingTitle}
                            amount={reward.amount}
                            collecting={collect.state === "collecting"}
                            onCollect={collect.collect}
                        />
                    )}
                    <EarningsSection
                        reward={reward}
                        collected={collected}
                        animated={!embedded}
                    />
                    {phase === "referrer-pending" && (
                        <ShareNudge variant="live" />
                    )}
                    {phase === "referee-earned" && (
                        <ShareNudge variant="turn" />
                    )}
                </Stack>
            </div>
            <span className={styles.statusBarScrim} aria-hidden="true" />
            <BottomTabBar />
            {!embedded && (
                <PendingGainsSheet
                    open={collect.sheetOpen}
                    amount={reward.amount}
                    collecting={collect.state === "collecting"}
                    onCollect={collect.collect}
                    onClose={collect.closeSheet}
                />
            )}
            {!embedded && collected && (
                <CollectedToast label={t("pendingGains.success")} />
            )}
            <AnimatePresence>
                {!embedded && collected && <Confetti key="confetti" />}
            </AnimatePresence>
        </div>
    );
}
