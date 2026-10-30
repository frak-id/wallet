import type {
    GameOutcome,
    GameResult,
    TicketSource,
} from "@frak-labs/backend-elysia/domain/game/schemas";
import { Badge } from "@frak-labs/design-system/components/Badge";
import { Box } from "@frak-labs/design-system/components/Box";
import { Button } from "@frak-labs/design-system/components/Button";
import { Card } from "@frak-labs/design-system/components/Card";
import { IconCircle } from "@frak-labs/design-system/components/IconCircle";
import { Inline } from "@frak-labs/design-system/components/Inline";
import { Notice } from "@frak-labs/design-system/components/Notice";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import {
    ExternalLinkIcon,
    GiftIcon,
    HourglassIcon,
    InstagramIcon,
} from "@frak-labs/design-system/icons";
import { backendUrl, openExternalUrl } from "@frak-labs/wallet-shared";
import { Ticket, TicketX } from "lucide-react";
import { useTranslation } from "react-i18next";
import { InfoCard, InfoRow } from "@/module/common/component/InfoCard";
import { formatGameAmount } from "@/module/game/utils/formatGameAmount";
import {
    formatGameDate,
    formatGameEnd,
} from "@/module/game/utils/formatGameDate";
import { prizeOf } from "@/module/game/utils/gamePrize";
import { modalStore } from "@/module/stores/modalStore";
import * as styles from "./index.css";

const OUTCOME = {
    drawing: {
        icon: HourglassIcon,
        tone: "action",
        badge: "info",
        label: "game.result.badge.drawing",
        title: "game.result.drawing.title",
        description: "game.result.drawing.description",
    },
    pending_verification: {
        icon: GiftIcon,
        tone: "action",
        badge: "warning",
        label: "game.result.badge.pendingVerification",
        title: "game.result.pendingVerification.title",
        description: "game.result.pendingVerification.description",
    },
    won: {
        icon: GiftIcon,
        tone: "action",
        badge: "success",
        label: "game.result.badge.won",
        title: "game.result.won.title",
        description: "game.result.won.description",
    },
    lost: {
        icon: Ticket,
        tone: "neutral",
        badge: "neutral",
        label: "game.result.badge.lost",
        title: "game.result.lost.title",
        description: "game.result.lost.description",
    },
    no_winner: {
        icon: TicketX,
        tone: "neutral",
        badge: "neutral",
        label: "game.result.badge.noWinner",
        title: "game.result.noWinner.title",
        description: "game.result.noWinner.description",
    },
} as const satisfies Record<GameOutcome, unknown>;

/** Every ticket source, in display order: a new one fails to compile until labelled. */
const SOURCE_LABELS = {
    join: "game.result.sources.join",
    instagramCertified: "game.result.sources.instagramCertified",
    purchase: "game.result.sources.purchase",
    referredPurchase: "game.result.sources.referredPurchase",
    referredSignup: "game.result.sources.referredSignup",
    brandShare: "game.result.sources.brandShare",
} as const satisfies Record<TicketSource, string>;

const SOURCES = Object.keys(SOURCE_LABELS) as TicketSource[];

export function OutcomeBadge({ outcome }: { outcome: GameOutcome }) {
    const { t } = useTranslation();
    return (
        <Badge size="small" variant={OUTCOME[outcome].badge}>
            {t(OUTCOME[outcome].label)}
        </Badge>
    );
}

/** How the draw went for the user, led by an icon for the outcome. */
export function OutcomeHero({ result }: { result: GameResult }) {
    const { t, i18n } = useTranslation();
    const copy = OUTCOME[result.outcome];
    const Icon = copy.icon;
    const prize = formatGameAmount(result.game.prizeAmount, i18n.language);
    const date = result.verifyBy
        ? formatGameEnd(result.verifyBy, i18n.language)
        : "";

    return (
        <Stack space="m" align="center">
            <IconCircle size="lg" tone={copy.tone}>
                <Icon width={24} height={24} />
            </IconCircle>
            <Stack space="xs" align="center">
                <Text variant="heading2" as="h2" align="center">
                    {t(copy.title, { prize })}
                </Text>
                <Text color="secondary" align="center">
                    {t(copy.description, { date })}
                </Text>
            </Stack>
        </Stack>
    );
}

function Stat({ label, value }: { label: string; value: string | number }) {
    return (
        <InfoRow
            labelVariant="bodySmall"
            labelColor="secondary"
            label={label}
            action={
                <Text variant="bodySmall" weight="medium">
                    {value}
                </Text>
            }
        />
    );
}

/**
 * The numbers behind a result, where the user's tickets came from, and the
 * way to the prize for a winner: a link, or `onSeePrize` from inside a modal.
 * `withCta` off leaves the way on to a hero that carries its own button.
 */
export function GameResultDetail({
    result,
    onSeePrize,
    withCta = true,
}: {
    result: GameResult;
    onSeePrize?: () => void;
    withCta?: boolean;
}) {
    const { t, i18n } = useTranslation();
    const sources = SOURCES.filter((source) => result.ticketsBySource[source]);

    return (
        <>
            {withCta && result.outcome === "won" && (
                <InfoCard>
                    <InfoRow
                        icon={GiftIcon}
                        label={t("game.result.won.cta")}
                        {...(onSeePrize
                            ? { onClick: onSeePrize }
                            : { to: "/history" })}
                    />
                </InfoCard>
            )}
            {withCta && result.outcome === "pending_verification" && (
                <InfoCard>
                    <InfoRow
                        icon={InstagramIcon}
                        label={t("game.result.pendingVerification.cta")}
                        to="/profile/instagram"
                    />
                </InfoCard>
            )}
            {result.discarded && result.outcome !== "won" && (
                <Notice tone="warning">
                    {t(
                        result.discarded === "not_linked"
                            ? "game.result.discardedNotLinked"
                            : "game.result.discarded"
                    )}
                </Notice>
            )}
            <InfoCard>
                <Stat
                    label={t("game.result.prize")}
                    value={prizeOf(result.game, i18n.language)}
                />
                <Stat
                    label={t("game.result.endedAt")}
                    value={formatGameDate(result.game.endsAt, i18n.language)}
                />
                {result.participants !== null && (
                    <Stat
                        label={t("game.result.participants")}
                        value={result.participants}
                    />
                )}
                {result.totalTickets !== null && (
                    <Stat
                        label={t("game.result.totalTickets")}
                        value={result.totalTickets}
                    />
                )}
                <Stat
                    label={t("game.result.myTickets")}
                    value={result.drawTickets}
                />
            </InfoCard>
            {sources.length > 0 && (
                <Stack space="xs">
                    <Text weight="semiBold">
                        {t("game.result.sources.title")}
                    </Text>
                    <InfoCard>
                        {sources.map((source) => (
                            <Stat
                                key={source}
                                label={t(SOURCE_LABELS[source])}
                                value={result.ticketsBySource[source]}
                            />
                        ))}
                    </InfoCard>
                </Stack>
            )}
            {result.pid && (
                <VerifyDraw gameId={result.game.id} pid={result.pid} />
            )}
        </>
    );
}

/** Kept low-key on purpose: only the curious go and check the public record. */
function VerifyDraw({ gameId, pid }: { gameId: string; pid: string }) {
    const { t } = useTranslation();
    return (
        <Stack space="xxs" align="center">
            <Button
                variant="ghost"
                size="small"
                width="auto"
                rightIcon={<ExternalLinkIcon />}
                onClick={() =>
                    void openExternalUrl(
                        `${backendUrl}/common/game/${gameId}/draw`
                    )
                }
            >
                {t("game.result.verify.link")}
            </Button>
            <Text variant="caption" color="secondary" align="center">
                {t("game.result.verify.pid", { pid })}
            </Text>
        </Stack>
    );
}

/** One grouped card, a row per game; a row opens that game's result. */
export function PastGames({ results }: { results: GameResult[] }) {
    const { t } = useTranslation();
    if (results.length === 0) return null;

    return (
        <Stack space="xs">
            <Text weight="semiBold">{t("game.history.title")}</Text>
            <Card padding="none">
                {results.map((result) => (
                    <PastGameRow key={result.game.id} result={result} />
                ))}
            </Card>
        </Stack>
    );
}

function PastGameRow({ result }: { result: GameResult }) {
    const { t, i18n } = useTranslation();
    const tickets = result.discarded
        ? t("game.history.notCounted")
        : result.totalTickets === null
          ? t("game.history.tickets", { count: result.drawTickets })
          : t("game.history.ticketsOf", {
                count: result.drawTickets,
                total: result.totalTickets,
            });

    return (
        <button
            type="button"
            className={styles.row}
            onClick={() =>
                modalStore.getState().openModal({ id: "gameResult", result })
            }
        >
            <Inline space="m" padding="m" alignY="center" wrap={false}>
                <Box className={styles.iconBubble}>
                    <Ticket size={20} />
                </Box>
                <Stack space="xxs" className={styles.rowInfo}>
                    <Text weight="medium">
                        {t("game.history.gameOf", {
                            date: formatGameDate(
                                result.game.endsAt,
                                i18n.language
                            ),
                        })}
                    </Text>
                    <Text variant="bodySmall" color="secondary">
                        {tickets}
                    </Text>
                </Stack>
                <Box className={styles.rowBadge}>
                    <OutcomeBadge outcome={result.outcome} />
                </Box>
            </Inline>
        </button>
    );
}
