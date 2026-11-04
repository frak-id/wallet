import { Card } from "@frak-labs/design-system/components/Card";
import { Inline } from "@frak-labs/design-system/components/Inline";
import { Spinner } from "@frak-labs/design-system/components/Spinner";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import {
    BankIcon,
    CheckCircleFilledIcon,
    DocumentIcon,
    LogoFrakBadge,
    PersonIcon,
    SafetyIcon,
} from "@frak-labs/design-system/icons";
import { AnimatePresence, motion } from "motion/react";
import { type ReactNode, useCallback, useEffect, useState } from "react";
import { useDemoNav } from "@/core/store";
import { bank } from "@/data/bank";
import { useT } from "@/i18n";
import { useDelayedFlag } from "@/shell/useDelayedFlag";
import type { CashOutSetupProps } from "@/surfaces/contracts";
import { FlowPages, FlowScreen } from "../components/FlowScreen";
import { maskIban } from "../format";
import { walletMessages } from "../messages";
import { WalletHome } from "../WalletHome";
import * as styles from "./cashOutSetup.css";
import { MoneriumMark } from "./MoneriumMark";

type Stage = "info" | "handoff" | "success";

const HANDOFF_ROW_MS = [700, 1300, 1900] as const;
const HANDOFF_BACK_MS = 2500;
const HANDOFF_DONE_MS = 3300;

const FEATURES = [
    { key: "feature1", Icon: PersonIcon },
    { key: "feature2", Icon: BankIcon },
    { key: "feature3", Icon: SafetyIcon },
] as const;

/** `MoneriumConnectScreen`, variant `info`: what the first transfer asks for. */
function InfoScreen({ onAccept }: { onAccept: () => void }) {
    const t = useT(walletMessages);
    return (
        <FlowScreen
            title={t("bankFlow.info.title")}
            description={t("bankFlow.info.description")}
            cta={{ label: t("bankFlow.info.cta"), onClick: onAccept }}
            secondary={{ label: t("bankFlow.info.secondaryCta") }}
        >
            <Text variant="body" color="secondary">
                {t("bankFlow.info.redirectNotice")}
            </Text>
            <Card variant="elevated" padding="none">
                <Stack space="none">
                    {FEATURES.map(({ key, Icon }) => (
                        <div key={key} className={styles.featureCell}>
                            <Inline space="m" alignY="top" wrap={false}>
                                <span className={styles.featureIconSlot}>
                                    <Icon width={24} height={24} />
                                </span>
                                <Stack space="xxs">
                                    <Text variant="body" weight="medium">
                                        {t(`bankFlow.info.${key}Title`)}
                                    </Text>
                                    <Text variant="bodySmall" color="secondary">
                                        {t(`bankFlow.info.${key}Description`)}
                                    </Text>
                                </Stack>
                            </Inline>
                        </div>
                    ))}
                </Stack>
            </Card>
        </FlowScreen>
    );
}

function HandoffRow({
    icon,
    label,
    value,
    doneAfter,
}: {
    icon: ReactNode;
    label: string;
    value: string;
    doneAfter: number;
}) {
    const done = useDelayedFlag(doneAfter);
    return (
        <div className={styles.handoffRow}>
            <Inline
                space="m"
                alignY="center"
                align="space-between"
                wrap={false}
            >
                <Inline space="m" alignY="center" wrap={false}>
                    <span className={styles.handoffIcon}>{icon}</span>
                    <Text variant="body" weight="medium">
                        {label}
                    </Text>
                </Inline>
                {done ? (
                    <motion.span
                        className={styles.handoffState}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                    >
                        <Text variant="bodySmall" color="secondary">
                            {value}
                        </Text>
                        <CheckCircleFilledIcon width={20} height={20} />
                    </motion.span>
                ) : (
                    <Spinner size="s" />
                )}
            </Inline>
        </div>
    );
}

/** The redirect to Monerium's KYC, condensed to one beat: each item validated, then back to Frak. */
function HandoffScreen({ onDone }: { onDone: () => void }) {
    const t = useT(walletMessages);
    const back = useDelayedFlag(HANDOFF_BACK_MS);
    useEffect(() => {
        const timer = window.setTimeout(onDone, HANDOFF_DONE_MS);
        return () => window.clearTimeout(timer);
    }, [onDone]);

    return (
        <FlowScreen
            title={t("bankFlow.handoff.title")}
            description={t("bankFlow.handoff.description")}
        >
            <Inline
                space="s"
                align="center"
                alignY="center"
                className={styles.partners}
            >
                <LogoFrakBadge
                    width={40}
                    height={40}
                    className={styles.frakBadge}
                />
                <Inline space="xxs" alignY="center" wrap={false}>
                    <span className={styles.dot} />
                    <span className={styles.dot} />
                    <span className={styles.dot} />
                </Inline>
                <MoneriumMark />
            </Inline>
            <Card variant="elevated" padding="none">
                <HandoffRow
                    icon={<DocumentIcon width={22} height={22} />}
                    label={t("bankFlow.handoff.document")}
                    value={t("bankFlow.handoff.documentVerified")}
                    doneAfter={HANDOFF_ROW_MS[0]}
                />
                <HandoffRow
                    icon={<PersonIcon width={22} height={22} />}
                    label={t("bankFlow.handoff.selfie")}
                    value={t("bankFlow.handoff.selfieVerified")}
                    doneAfter={HANDOFF_ROW_MS[1]}
                />
                <HandoffRow
                    icon={<BankIcon width={22} height={22} />}
                    label={t("bankFlow.handoff.iban")}
                    value={maskIban(bank.iban)}
                    doneAfter={HANDOFF_ROW_MS[2]}
                />
            </Card>
            <AnimatePresence>
                {back && (
                    <motion.div
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                    >
                        <Inline space="xs" align="center" alignY="center">
                            <Spinner size="s" />
                            <Text variant="bodySmall" color="secondary">
                                {t("bankFlow.handoff.back")}
                            </Text>
                        </Inline>
                    </motion.div>
                )}
            </AnimatePresence>
        </FlowScreen>
    );
}

/** Chloé's first "transfer to my bank": Monerium's setup over her wallet, verified on the spot. */
export function CashOutSetup({ persona }: CashOutSetupProps) {
    const t = useT(walletMessages);
    const { next } = useDemoNav();
    const [stage, setStage] = useState<Stage>("info");
    const toSuccess = useCallback(() => setStage("success"), []);

    return (
        <div className={styles.screen}>
            <div className={styles.layer} inert aria-hidden="true">
                <WalletHome
                    persona={persona}
                    phase="referee-earned"
                    embedded={true}
                    cashOut={true}
                />
            </div>
            <motion.div
                className={styles.layer}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.25, ease: "easeOut" }}
            >
                <FlowPages page={stage}>
                    {stage === "info" && (
                        <InfoScreen onAccept={() => setStage("handoff")} />
                    )}
                    {stage === "handoff" && (
                        <HandoffScreen onDone={toSuccess} />
                    )}
                    {stage === "success" && (
                        <FlowScreen
                            title={t("bankFlow.success.title")}
                            description={t("bankFlow.success.description")}
                            cta={{
                                label: t("bankFlow.success.cta"),
                                onClick: next,
                            }}
                        />
                    )}
                </FlowPages>
            </motion.div>
        </div>
    );
}
