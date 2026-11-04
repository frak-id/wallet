import { Button } from "@frak-labs/design-system/components/Button";
import { Card } from "@frak-labs/design-system/components/Card";
import { Inline } from "@frak-labs/design-system/components/Inline";
import { Input } from "@frak-labs/design-system/components/Input";
import { Spread } from "@frak-labs/design-system/components/Spread";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import {
    ArrowDownIcon,
    BankIcon,
    CircleCheckIcon,
} from "@frak-labs/design-system/icons";
import { AnimatePresence } from "motion/react";
import { useEffect, useState } from "react";
import { useDemoNav } from "@/core/store";
import { bank } from "@/data/bank";
import { campaign } from "@/data/rewards";
import { useLang, useT } from "@/i18n";
import { useFormatMoney } from "@/i18n/format";
import { DeviceOverlay } from "@/shell/DeviceOverlay";
import { PushNotification } from "@/shell/PushNotification";
import { useDelayedFlag } from "@/shell/useDelayedFlag";
import { BankAppIcon } from "@/surfaces/bank";
import type { BankTransferProps } from "@/surfaces/contracts";
import { BottomSheet } from "../components/BottomSheet";
import { FlowPages, FlowScreen, ToolbarLink } from "../components/FlowScreen";
import { FaceIdHud } from "../components/PasskeyPrompt";
import { maskIban } from "../format";
import { walletMessages } from "../messages";
import * as styles from "./bankTransfer.css";

type Stage = "success" | "amount" | "recap" | "scanning" | "verified" | "sent";

/** Face ID while the transfer is signed with the passkey, then its check. */
const SIGNING_MS: Partial<Record<Stage, [ms: number, then: Stage]>> = {
    scanning: [1100, "verified"],
    verified: [650, "sent"],
};
const BANK_PUSH_MS = 1500;

/** Her whole balance: the 5 € she collected. */
const AMOUNT = campaign.refereeReward;
const MONERIUM_DEFAULT_MEMO = "Frak Wallet offramp";

function AmountScreen({ onContinue }: { onContinue: () => void }) {
    const t = useT(walletMessages);
    const money = useFormatMoney();
    const decimalMark = useLang() === "fr" ? "," : ".";
    return (
        <FlowScreen
            leftIcon="back"
            title={t("bankFlow.amount.title")}
            cta={{ label: t("bankFlow.amount.continue"), onClick: onContinue }}
        >
            <div className={styles.cardsStack}>
                <Card variant="elevated" padding="cell">
                    <Stack space="xxs">
                        <Text variant="body" weight="medium">
                            {t("bankFlow.amount.walletLabel")}
                        </Text>
                        <Text variant="bodySmall" color="secondary">
                            {t("bankFlow.amount.totalBalance", {
                                amount: money(AMOUNT),
                            })}
                        </Text>
                    </Stack>
                </Card>
                <span className={styles.switcherIcon}>
                    <span className={styles.switcherDisc}>
                        <ArrowDownIcon width={20} height={20} />
                    </span>
                </span>
                <Card variant="elevated" padding="cell">
                    <Inline
                        space="m"
                        alignY="center"
                        align="space-between"
                        wrap={false}
                    >
                        <Stack space="xxs">
                            <Text variant="body" weight="medium">
                                {t("bankFlow.amount.ibanLabel")}
                            </Text>
                            <Text variant="bodySmall" color="secondary">
                                {maskIban(bank.iban)}
                            </Text>
                        </Stack>
                        <Button variant="secondary" size="small" width="auto">
                            {t("bankFlow.amount.modify")}
                        </Button>
                    </Inline>
                </Card>
            </div>
            <Stack space="xs" align="center" className={styles.amountSection}>
                <Inline space="xs" alignY="center" wrap={false}>
                    <span className={styles.amountValue}>
                        {AMOUNT.toFixed(2).replace(".", decimalMark)}
                        <span className={styles.caret} aria-hidden="true" />
                    </span>
                    <Text variant="display" weight="bold" color="primary">
                        €
                    </Text>
                </Inline>
            </Stack>
        </FlowScreen>
    );
}

function RecapScreen({
    signing,
    onBack,
    onConfirm,
}: {
    signing: boolean;
    onBack: () => void;
    onConfirm: () => void;
}) {
    const t = useT(walletMessages);
    const money = useFormatMoney();
    return (
        <FlowScreen
            leftIcon="back"
            onLeft={onBack}
            title={t("bankFlow.recap.title")}
            topRight={<ToolbarLink label={t("bankFlow.recap.cancel")} />}
            cta={{
                label: t("bankFlow.recap.confirm"),
                onClick: onConfirm,
                loading: signing,
            }}
        >
            <Card variant="elevated" padding="none">
                <Spread space="m" className={styles.recapRow}>
                    <Text variant="bodySmall" weight="medium" color="secondary">
                        {t("bankFlow.recap.amountLabel")}
                    </Text>
                    <Text variant="bodySmall" weight="medium" color="primary">
                        {money(AMOUNT)}
                    </Text>
                </Spread>
                <Spread space="m" align="top" className={styles.recapRow}>
                    <Text variant="bodySmall" weight="medium" color="secondary">
                        {t("bankFlow.recap.beneficiaryLabel")}
                    </Text>
                    <Stack space="none" align="right">
                        <Inline space="xxs" alignY="center" wrap={false}>
                            <span className={styles.beneficiaryIcon}>
                                <BankIcon width={16} height={16} />
                            </span>
                            <Text
                                variant="bodySmall"
                                weight="medium"
                                color="primary"
                            >
                                {bank.holder}
                            </Text>
                        </Inline>
                        <Text variant="caption" color="secondary">
                            {t("bankFlow.recap.beneficiaryIban", {
                                iban: maskIban(bank.iban),
                            })}
                        </Text>
                    </Stack>
                </Spread>
            </Card>
            <Input
                variant="bare"
                length="big"
                label={t("bankFlow.recap.addNote")}
                placeholder={MONERIUM_DEFAULT_MEMO}
                readOnly={true}
                tabIndex={-1}
            />
            <span className={styles.grow} />
            <Text variant="caption" color="secondary" align="center">
                {t("bankFlow.recap.warning")}
            </Text>
        </FlowScreen>
    );
}

/** `MoneriumTransferSuccessModal`: the request is in, the money is on its way. */
function SentSheet({ open }: { open: boolean }) {
    const t = useT(walletMessages);
    const money = useFormatMoney();
    const title = t("bankFlow.sent.title", { amount: money(AMOUNT) });
    return (
        <BottomSheet open={open} look="frak" handle={false} label={title}>
            <Stack space="m" align="center" className={styles.sent}>
                <span className={styles.sentIcon}>
                    <CircleCheckIcon />
                </span>
                <Text variant="heading2" weight="semiBold" align="center">
                    {title}
                </Text>
                <Text
                    variant="bodySmall"
                    weight="medium"
                    color="secondary"
                    align="center"
                >
                    {t("bankFlow.sent.description")}
                </Text>
            </Stack>
        </BottomSheet>
    );
}

/** The bank's own push, a beat after the request: tapping it opens the bank app. */
function BankPush() {
    const t = useT(walletMessages);
    const money = useFormatMoney();
    const { next } = useDemoNav();
    const landed = useDelayedFlag(BANK_PUSH_MS);
    if (!landed) return null;
    return (
        <DeviceOverlay>
            <PushNotification
                icon={<BankAppIcon />}
                title={bank.name}
                body={t("bankPush.body", {
                    sender: bank.senderName,
                    amount: money(AMOUNT),
                })}
                time={t("bankPush.time")}
                onTap={next}
            />
        </DeviceOverlay>
    );
}

/** Two days later, verified: success → amount → recap → Face ID → "on its way", then the bank's push. */
export function BankTransfer(_props: BankTransferProps) {
    const t = useT(walletMessages);
    const [stage, setStage] = useState<Stage>("success");

    useEffect(() => {
        const signing = SIGNING_MS[stage];
        if (!signing) return;
        const [ms, then] = signing;
        const timer = window.setTimeout(() => setStage(then), ms);
        return () => window.clearTimeout(timer);
    }, [stage]);

    const page =
        stage === "success" || stage === "amount" ? stage : ("recap" as const);
    const scanning = stage === "scanning" || stage === "verified";

    return (
        <div className={styles.screen}>
            <FlowPages page={page}>
                {page === "success" && (
                    <FlowScreen
                        title={t("bankFlow.success.title")}
                        description={t("bankFlow.success.description")}
                        cta={{
                            label: t("bankFlow.success.cta"),
                            onClick: () => setStage("amount"),
                        }}
                    />
                )}
                {page === "amount" && (
                    <AmountScreen onContinue={() => setStage("recap")} />
                )}
                {page === "recap" && (
                    <RecapScreen
                        signing={scanning}
                        onBack={() => setStage("amount")}
                        onConfirm={() =>
                            setStage((s) => (s === "recap" ? "scanning" : s))
                        }
                    />
                )}
            </FlowPages>
            <DeviceOverlay>
                <AnimatePresence>
                    {scanning && (
                        <FaceIdHud
                            key="faceId"
                            verified={stage === "verified"}
                        />
                    )}
                </AnimatePresence>
            </DeviceOverlay>
            <SentSheet open={stage === "sent"} />
            {stage === "sent" && <BankPush />}
        </div>
    );
}
