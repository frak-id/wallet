import { Card } from "@frak-labs/design-system/components/Card";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import { AnimatePresence } from "motion/react";
import { useEffect, useState } from "react";
import { useDemoNav } from "@/core/store";
import { useT } from "@/i18n";
import { useHoldContinue } from "@/shell/ContinuePrompt/hold";
import type { WalletHomeProps } from "@/surfaces/contracts";
import { walletMessages } from "../messages";
import { Balance } from "./Balance";
import { BottomTabBar } from "./BottomTabBar";
import { CollectedToast, Confetti } from "./Celebration";
import { PendingGainsSheet } from "./PendingGains";
import {
    type PhaseReward,
    type PhaseTransfer,
    phaseRewards,
    phaseTransfers,
} from "./phases";
import { RewardRow } from "./RewardRow";
import { ShareNudge } from "./ShareNudge";
import { TransferRow } from "./TransferRow";
import * as styles from "./walletHome.css";

type CollectState = "pending" | "collecting" | "collected";

const SHEET_DELAY_MS = 650;
const COLLECT_MS = 1100;

/** Each persona collects on her own wallet step: an embedded view shows the reward banked. */
function useCollect(embedded: boolean) {
    const [state, setState] = useState<CollectState>(
        embedded ? "collected" : "pending"
    );
    const [sheetOpen, setSheetOpen] = useState(false);

    useEffect(() => {
        if (embedded) return;
        const timer = window.setTimeout(
            () => setSheetOpen(true),
            SHEET_DELAY_MS
        );
        return () => window.clearTimeout(timer);
    }, [embedded]);

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
        sheetOpen,
        collect: () => setState((s) => (s === "pending" ? "collecting" : s)),
        openSheet: () => {
            if (state === "pending" && !embedded) {
                setSheetOpen(true);
            }
        },
        closeSheet: () => setSheetOpen(false),
    };
}

function EarningsSection({
    reward,
    transfer,
    collected,
    animated,
}: {
    reward: PhaseReward;
    transfer: PhaseTransfer | undefined;
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
                {transfer && <TransferRow transfer={transfer} />}
                <RewardRow
                    reward={reward}
                    status={collected ? "consumed" : "settled"}
                    animated={animated}
                />
            </Card>
        </Stack>
    );
}

/** The wallet home: title, balance, earnings history and the tab bar. */
export function WalletHome({
    phase,
    embedded = false,
    cashOut = false,
}: WalletHomeProps) {
    const t = useT(walletMessages);
    const { next } = useDemoNav();
    const reward = phaseRewards[phase];
    const transfer = phaseTransfers[phase];
    const collect = useCollect(embedded);
    const collected = collect.state === "collected";
    const transferable = cashOut && collected && !embedded;
    useHoldContinue(collect.sheetOpen || collect.state === "collecting");

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
                        balance={
                            collected
                                ? reward.amount - (transfer?.amount ?? 0)
                                : 0
                        }
                        pending={collected ? 0 : reward.amount}
                        lifetime={collected ? reward.amount : 0}
                        onPendingClick={collect.openSheet}
                        onTransfer={transferable ? next : undefined}
                    />
                    <EarningsSection
                        reward={reward}
                        transfer={transfer}
                        collected={collected}
                        animated={!embedded}
                    />
                    {phase === "referee-earned" && <ShareNudge />}
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
