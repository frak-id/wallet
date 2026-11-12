import { Box } from "@frak-labs/design-system/components/Box";
import { Card } from "@frak-labs/design-system/components/Card";
import { EmptyState } from "@frak-labs/design-system/components/EmptyState";
import { Inline } from "@frak-labs/design-system/components/Inline";
import { Notice } from "@frak-labs/design-system/components/Notice";
import { Spinner } from "@frak-labs/design-system/components/Spinner";
import { Spread } from "@frak-labs/design-system/components/Spread";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import { CheckIcon, CopyIcon } from "@frak-labs/design-system/icons";
import { backendUrl } from "@frak-labs/wallet-shared/common/api/backendClient";
import { ExternalLink } from "@frak-labs/wallet-shared/common/component/ExternalLink";
import { useCopyToClipboardWithState } from "@frak-labs/wallet-shared/common/hook/useCopyToClipboardWithState";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Title } from "@/module/common/component/Title";
import { useGameDraw } from "@/module/game/hook/useGameDraw";
import {
    type DrawMe,
    type DrawPhase,
    type DrawSummary,
    shortPid,
    summarizeDraw,
} from "@/module/game/utils/drawSummary";
import {
    formatGameDeadline,
    formatGameEnd,
} from "@/module/game/utils/formatGameDate";
import * as styles from "./index.css";

/** Every phase of the draw, in the order it happens: a new one fails to compile until worded. */
const PHASE = {
    scheduled: { label: "gameDraw.phase.scheduled", tone: "info" },
    drawing: { label: "gameDraw.phase.drawing", tone: "info" },
    checking: { label: "gameDraw.phase.checking", tone: "info" },
    confirmed: { label: "gameDraw.phase.confirmed", tone: "success" },
    noWinner: { label: "gameDraw.phase.noWinner", tone: "neutral" },
} as const satisfies Record<DrawPhase, unknown>;

const drandUrl = ({ chainHash, round }: DrawSummary["drand"]) =>
    `https://api.drand.sh/${chainHash}/public/${round}`;

/**
 * The public record of a game's draw: where it stands and, given a pid, where
 * that player stands in it. Renders into the caller's page `Stack`.
 */
export function GameDrawView({
    gameId,
    pid,
}: {
    /** Absent when the link carried no usable game id. */
    gameId?: string;
    pid?: string;
}) {
    const { t } = useTranslation();
    return (
        <>
            <Title size="page">{t("gameDraw.title")}</Title>
            {gameId ? (
                <DrawRecord gameId={gameId} pid={pid} />
            ) : (
                <EmptyState
                    title={t("gameDraw.invalid.title")}
                    description={t("gameDraw.invalid.description")}
                />
            )}
        </>
    );
}

function DrawRecord({ gameId, pid }: { gameId: string; pid?: string }) {
    const { t } = useTranslation();
    const { data, isPending, isError, refetch } = useGameDraw(gameId);

    if (isPending) {
        return (
            <Stack space="s" align="center" role="status">
                <Spinner />
                <Text color="secondary">{t("gameDraw.loading")}</Text>
            </Stack>
        );
    }
    if (isError) {
        return (
            <EmptyState
                title={t("gameDraw.error.title")}
                description={t("gameDraw.error.description")}
                action={{
                    label: t("gameDraw.error.retry"),
                    onClick: () => void refetch(),
                }}
            />
        );
    }
    if (!data) {
        return (
            <EmptyState
                title={t("gameDraw.notDrawn.title")}
                description={t("gameDraw.notDrawn.description")}
            />
        );
    }

    const summary = summarizeDraw(data, pid);
    return (
        <>
            <PhaseLine summary={summary} />
            {summary.me && pid && <MeCard me={summary.me} pid={pid} />}
            <SummaryCard summary={summary} />
            <HowItWorks />
            <Links gameId={gameId} summary={summary} />
        </>
    );
}

function PhaseLine({ summary }: { summary: DrawSummary }) {
    const { t, i18n } = useTranslation();
    const { label, tone } = PHASE[summary.phase];
    return (
        <Notice tone={tone}>
            {t(label, {
                date: formatGameEnd(summary.drand.roundTime, i18n.language),
            })}
        </Notice>
    );
}

function Row({ label, value }: { label: string; value: ReactNode }) {
    return (
        <Spread space="s">
            <Text variant="bodySmall" color="secondary">
                {label}
            </Text>
            <Text
                variant="bodySmall"
                weight="medium"
                as="span"
                className={styles.value}
            >
                {value}
            </Text>
        </Spread>
    );
}

/** `12 %`, never rounded down to `0 %`: two significant digits keep a small chance visible. */
const formatShare = (share: number, locale: string) =>
    new Intl.NumberFormat(locale, {
        style: "percent",
        maximumSignificantDigits: 2,
    }).format(share);

function MeCard({ me, pid }: { me: DrawMe; pid: string }) {
    const { t, i18n } = useTranslation();
    return (
        <Card>
            <Stack space="s">
                <Text variant="heading4" as="h2">
                    {t("gameDraw.me.title")}
                </Text>
                {me.found ? (
                    <>
                        {me.isWinner && (
                            <Notice tone="success">
                                {t("gameDraw.me.won")}
                            </Notice>
                        )}
                        <Row
                            label={t("gameDraw.me.tickets")}
                            value={me.tickets.toLocaleString(i18n.language)}
                        />
                        <Row
                            label={t("gameDraw.me.chance")}
                            value={formatShare(me.share, i18n.language)}
                        />
                        {me.candidateRank !== null && (
                            <Row
                                label={t("gameDraw.me.rank")}
                                value={t("gameDraw.me.rankValue", {
                                    rank: me.candidateRank,
                                })}
                            />
                        )}
                    </>
                ) : (
                    <Text color="secondary">{t("gameDraw.me.notFound")}</Text>
                )}
                <PidRow pid={pid} />
            </Stack>
        </Card>
    );
}

function PidRow({ pid }: { pid: string }) {
    const { t } = useTranslation();
    const { copied, copy } = useCopyToClipboardWithState();
    const Icon = copied ? CheckIcon : CopyIcon;
    return (
        <Box
            as="button"
            type="button"
            aria-label={
                copied ? t("gameDraw.me.copied") : t("gameDraw.me.copyLabel")
            }
            className={styles.pidRow}
            onClick={() => copy(pid)}
        >
            <Text variant="bodySmall" color="secondary" as="span">
                {t("gameDraw.me.pid")}
            </Text>
            <Inline space="xs" alignY="center">
                <Text variant="bodySmall" weight="medium" as="span">
                    {shortPid(pid)}
                </Text>
                <Icon width={16} height={16} className={styles.pidIcon} />
            </Inline>
        </Box>
    );
}

function payoutLabel(summary: DrawSummary) {
    switch (summary.payout.state) {
        case "paid":
            return "gameDraw.summary.payoutPaid";
        case "pending":
            return "gameDraw.summary.payoutPending";
        case "none":
            return null;
    }
}

function SummaryCard({ summary }: { summary: DrawSummary }) {
    const { t, i18n } = useTranslation();
    const { drand } = summary;
    const payout = payoutLabel(summary);
    return (
        <Card>
            <Stack space="s">
                <Text variant="heading4" as="h2">
                    {t("gameDraw.summary.title")}
                </Text>
                <Row
                    label={t("gameDraw.summary.participants")}
                    value={summary.participants.toLocaleString(i18n.language)}
                />
                <Row
                    label={t("gameDraw.summary.totalTickets")}
                    value={summary.totalTickets.toLocaleString(i18n.language)}
                />
                <Row
                    label={t("gameDraw.summary.frozenAt")}
                    value={formatGameDeadline(summary.frozenAt, i18n.language)}
                />
                <Row
                    label={t("gameDraw.summary.random")}
                    value={t("gameDraw.summary.randomRound", {
                        round: drand.round,
                    })}
                />
                <Row
                    label={t(
                        drand.published
                            ? "gameDraw.summary.randomAt"
                            : "gameDraw.summary.randomDue"
                    )}
                    value={formatGameDeadline(drand.roundTime, i18n.language)}
                />
                <Row
                    label={t("gameDraw.summary.winner")}
                    value={
                        summary.winner?.short ??
                        t(
                            summary.phase === "noWinner"
                                ? "gameDraw.summary.winnerNobody"
                                : "gameDraw.summary.winnerNone"
                        )
                    }
                />
                {payout && (
                    <Row
                        label={t("gameDraw.summary.payout")}
                        value={t(payout)}
                    />
                )}
            </Stack>
        </Card>
    );
}

function HowItWorks() {
    const { t } = useTranslation();
    return (
        <Stack space="s">
            <Text variant="heading4" as="h2">
                {t("gameDraw.how.title")}
            </Text>
            <Text color="secondary">{t("gameDraw.how.freeze")}</Text>
            <Text color="secondary">{t("gameDraw.how.random")}</Text>
            <Text color="secondary">{t("gameDraw.how.rank")}</Text>
            <Text color="secondary">{t("gameDraw.how.winner")}</Text>
        </Stack>
    );
}

function Links({ gameId, summary }: { gameId: string; summary: DrawSummary }) {
    const { t } = useTranslation();
    return (
        <Stack space="none" align="center">
            <ExternalLink
                href={`${backendUrl}/common/game/${gameId}/draw`}
                className={styles.link}
            >
                {t("gameDraw.links.raw")}
            </ExternalLink>
            {summary.drand.published && (
                <ExternalLink
                    href={drandUrl(summary.drand)}
                    className={styles.link}
                >
                    {t("gameDraw.links.drand")}
                </ExternalLink>
            )}
        </Stack>
    );
}
