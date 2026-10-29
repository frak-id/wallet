import type {
    CurrentGameResponse,
    GameResult,
} from "@frak-labs/backend-elysia/domain/game/schemas";
import { Spread } from "@frak-labs/design-system/components/Spread";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import {
    CheckIcon,
    ChevronRightIcon,
    GiftIcon,
    InstagramIcon,
    LockIcon,
} from "@frak-labs/design-system/icons";
import { visuallyHidden } from "@frak-labs/design-system/utils";
import { trackEvent } from "@frak-labs/wallet-shared";
import type { DefaultTranslate } from "@frak-labs/wallet-shared/types";
import { useNavigate } from "@tanstack/react-router";
import type { ComponentType, ReactNode, SVGProps } from "react";
import { useTranslation } from "react-i18next";
import { ICONS, REWARDS } from "@/module/game/component/GameMissions";
import { OUTCOME } from "@/module/game/component/GameResultView";
import { useCurrentGame } from "@/module/game/hook/useCurrentGame";
import { useGameHistory } from "@/module/game/hook/useGameHistory";
import { useNow } from "@/module/game/hook/useNow";
import { gameSeenStore } from "@/module/game/stores/gameSeenStore";
import { formatGameAmount } from "@/module/game/utils/formatGameAmount";
import {
    formatGameDate,
    formatGameDeadline,
} from "@/module/game/utils/formatGameDate";
import { countdownOf } from "@/module/game/utils/gameCountdown";
import { openDeadline, timeLeftOf } from "@/module/game/utils/gameDeadline";
import { gainsSince } from "@/module/game/utils/gameGains";
import { homeCardOf } from "@/module/game/utils/gameHomeCard";
import {
    type TicketCardStatus,
    ticketCardOf,
} from "@/module/game/utils/gameTicketCard";
import { totalTickets } from "@/module/game/utils/ticketAmounts";
import * as ticket from "./index.css";

/**
 * Wallet-home recap: a draw waiting on the user first (straight to certifying),
 * then the open game, or the last game played when it ended recently; hidden otherwise.
 */
export function GameCard() {
    const { data } = useCurrentGame();
    const history = useGameHistory();
    const card = homeCardOf(data, history.data);

    switch (card?.kind) {
        case "drawn":
            return <DrawnGameCard result={card.result} />;
        case "open":
            return <OpenGameCard game={card.game} me={card.me} />;
        case "ended":
            return <EndedGameCard result={card.result} />;
        default:
            return null;
    }
}

type OpenGame = {
    id: string;
    endsAt: Date | string;
    prizeAmount: number;
    prizeDescription: string | null;
};

type Me = CurrentGameResponse["me"];

type Icon = ComponentType<SVGProps<SVGSVGElement>>;

const STATUS_TONE = {
    join: "action",
    locked: "locked",
    next: "action",
    allDone: "done",
} as const satisfies Record<TicketCardStatus["kind"], string>;

const countSize = (count: number) =>
    count < 100 ? "short" : count < 1000 ? "medium" : "long";

const prizeSize = (text: string) =>
    text.length <= 4
        ? "short"
        : text.length <= 5
          ? "medium"
          : text.length <= 7
            ? "long"
            : "longest";

/** The ticket shape: a stub on the left, the card's main button, a headline and a status line. */
function TicketShell({
    tone,
    stub,
    ariaLabel,
    onOpen,
    pill,
    headline,
    status,
}: {
    tone: "active" | "muted";
    stub: ReactNode;
    ariaLabel: string;
    onOpen: () => void;
    pill: ReactNode;
    headline: ReactNode;
    status: ReactNode;
}) {
    const { t } = useTranslation();

    return (
        <div className={ticket.root}>
            <div className={ticket.face}>
                <div className={ticket.stub({ tone })}>{stub}</div>
                <Stack space="xxs" justify="center" className={ticket.main}>
                    <Spread space="xs">
                        <button
                            type="button"
                            className={ticket.mainButton}
                            aria-label={ariaLabel}
                            onClick={onOpen}
                        >
                            <Text
                                as="span"
                                variant="caption"
                                weight="semiBold"
                                color="secondary"
                            >
                                {t("game.card.label")}
                            </Text>
                        </button>
                        {pill}
                    </Spread>
                    {headline}
                    {status}
                </Stack>
            </div>
        </div>
    );
}

/** The open game as a ticket: the player's count on the stub, the prize, and the next action. */
export function OpenGameCard({ game, me }: { game: OpenGame; me: Me }) {
    const { t, i18n } = useTranslation();
    const navigate = useNavigate();
    const status = ticketCardOf(me);
    const baseline = gameSeenStore((s) => s.seen[game.id]);
    const gained = me.participating
        ? gainsSince(baseline ?? null, me).total
        : 0;
    const amount = game.prizeDescription === null;
    const prize =
        game.prizeDescription ??
        formatGameAmount(game.prizeAmount, i18n.language);
    const unit = me.participating
        ? t("game.card.ticket", { count: me.tickets })
        : t("game.card.yourTicket");
    const muted = status.kind === "join" || status.kind === "locked";
    const target = me.participating ? "game" : "join";

    return (
        <TicketShell
            tone={muted ? "muted" : "active"}
            stub={
                <>
                    <span
                        aria-hidden="true"
                        className={ticket.count({
                            size: countSize(me.tickets),
                        })}
                    >
                        {me.participating ? me.tickets : "?"}
                    </span>
                    <span aria-hidden="true" className={ticket.unit}>
                        {unit}
                    </span>
                    {status.kind === "locked" && (
                        <LockIcon width={14} height={14} />
                    )}
                    {(status.kind === "next" || status.kind === "allDone") && (
                        <CheckIcon width={14} height={14} />
                    )}
                    {gained > 0 && (
                        <span className={ticket.stamp}>
                            +{gained}
                            <span className={visuallyHidden}>
                                {t("game.card.gained", { count: gained })}
                            </span>
                        </span>
                    )}
                </>
            }
            ariaLabel={t("game.card.ariaLabel", { prize, tickets: unit })}
            onOpen={() => {
                trackEvent("game_card_clicked", {
                    game_id: game.id,
                    participating: me.participating,
                    state: "open",
                    target,
                });
                navigate({ to: me.participating ? "/game" : "/game/join" });
            }}
            pill={<Countdown endsAt={game.endsAt} />}
            headline={
                <>
                    <span
                        className={ticket.headline({
                            kind: amount ? "amount" : "description",
                        })}
                    >
                        {prize}
                    </span>
                    {amount && (
                        <Text variant="bodySmall" color="secondary">
                            {t("game.card.toWin")}
                        </Text>
                    )}
                </>
            }
            status={<StatusLine status={status} />}
        />
    );
}

/** A draw waiting on the user: the prize on the stub, the time left, and the way to certify. */
function DrawnGameCard({ result }: { result: GameResult }) {
    const { t, i18n } = useTranslation();
    const navigate = useNavigate();
    const now = useNow(30_000);
    const deadline = openDeadline(result, now);
    const prize = formatGameAmount(result.game.prizeAmount, i18n.language);

    return (
        <TicketShell
            tone="active"
            stub={<PrizeFace prize={prize} Badge={GiftIcon} />}
            ariaLabel={t("game.card.drawnAriaLabel", { prize })}
            onOpen={() => {
                trackEvent("game_card_clicked", {
                    game_id: result.game.id,
                    participating: true,
                    state: "drawn",
                    target: "game",
                });
                navigate({ to: "/game" });
            }}
            pill={
                deadline && (
                    <span className={ticket.pill({ urgent: true })}>
                        {timeLeftOf(t, countdownOf(deadline, now))}
                    </span>
                )
            }
            headline={<Headline>{t("game.card.drawn")}</Headline>}
            status={
                <StatusRow
                    tone="action"
                    Icon={InstagramIcon}
                    title={t("game.result.pendingVerification.cta")}
                    detail={
                        deadline
                            ? t("game.result.hero.deadline", {
                                  date: formatGameDeadline(
                                      deadline,
                                      i18n.language
                                  ),
                              })
                            : null
                    }
                />
            }
        />
    );
}

/** How a recent game went: the prize or the tickets on the stub, the outcome as the headline. */
function EndedGameCard({ result }: { result: GameResult }) {
    const { t, i18n } = useTranslation();
    const navigate = useNavigate();
    const { badge: Badge, face, title } = OUTCOME[result.outcome];
    const prize = formatGameAmount(result.game.prizeAmount, i18n.language);
    const tickets = totalTickets(result.ticketsBySource);
    const headline = t(title, { prize });
    const date = formatGameDate(result.game.endsAt, i18n.language);

    return (
        <TicketShell
            tone={
                result.outcome === "lost" || result.outcome === "no_winner"
                    ? "muted"
                    : "active"
            }
            stub={
                face === "prize" ? (
                    <PrizeFace prize={prize} Badge={Badge} />
                ) : (
                    <>
                        <span
                            aria-hidden="true"
                            className={ticket.count({
                                size: countSize(tickets),
                            })}
                        >
                            {tickets}
                        </span>
                        <span aria-hidden="true" className={ticket.unit}>
                            {t("game.card.ticket", { count: tickets })}
                        </span>
                        {Badge && <Badge width={14} height={14} />}
                    </>
                )
            }
            ariaLabel={t("game.card.endedAriaLabel", {
                date,
                outcome: headline,
            })}
            onOpen={() => {
                trackEvent("game_card_clicked", {
                    game_id: result.game.id,
                    participating: true,
                    state: "ended",
                    target: "game",
                });
                navigate({ to: "/game" });
            }}
            pill={
                <span className={ticket.pill({})}>
                    {t("game.history.gameOf", { date })}
                </span>
            }
            headline={<Headline>{headline}</Headline>}
            status={
                <StatusRow
                    tone="action"
                    title={t("game.card.statusResult")}
                    detail={null}
                />
            }
        />
    );
}

function PrizeFace({ prize, Badge }: { prize: string; Badge: Icon | null }) {
    return (
        <>
            <span
                aria-hidden="true"
                className={ticket.prize({ size: prizeSize(prize) })}
            >
                {prize}
            </span>
            {Badge && <Badge width={14} height={14} />}
        </>
    );
}

function Headline({ children }: { children: ReactNode }) {
    return (
        <span className={ticket.headline({ kind: "description" })}>
            {children}
        </span>
    );
}

function Countdown({ endsAt }: { endsAt: Date | string }) {
    const { t } = useTranslation();
    const countdown = countdownOf(endsAt, useNow(30_000));
    if (countdown.over) return null;
    return (
        <span className={ticket.pill({ urgent: countdown.urgent })}>
            {countdown.days >= 1
                ? t("game.page.hero.countdownDays", countdown)
                : t("game.page.hero.countdownHours", countdown)}
        </span>
    );
}

function statusText(status: TicketCardStatus, t: DefaultTranslate) {
    switch (status.kind) {
        case "join":
            return {
                title: t("game.card.statusJoin"),
                detail: t("game.card.statusJoinReward"),
            };
        case "locked":
        case "next":
            return {
                title: t(status.mission.title),
                detail: t(REWARDS[status.mission.id], {
                    count: status.mission.reward,
                }),
            };
        case "allDone":
            return { title: t("game.card.statusAllDone"), detail: null };
    }
}

function iconOf(status: TicketCardStatus) {
    if (status.kind === "join") return GiftIcon;
    if (status.kind === "locked") return LockIcon;
    if (status.kind === "next") return ICONS[status.mission.id];
    return CheckIcon;
}

function StatusLine({ status }: { status: TicketCardStatus }) {
    const { t } = useTranslation();
    return (
        <StatusRow
            tone={STATUS_TONE[status.kind]}
            Icon={iconOf(status)}
            {...statusText(status, t)}
        />
    );
}

/** The card's last row; the main button's stretched area covers it, so a tap anywhere opens the game. */
function StatusRow({
    tone,
    Icon,
    title,
    detail,
}: {
    tone: (typeof STATUS_TONE)[TicketCardStatus["kind"]];
    Icon?: Icon;
    title: string;
    detail: string | null;
}) {
    return (
        <div className={ticket.status({ tone })}>
            {Icon && <Icon width={16} height={16} className={ticket.icon} />}
            <span className={ticket.statusText}>
                {title}
                {detail && (
                    <>
                        {" "}
                        <Text as="span" variant="caption" color="secondary">
                            {detail}
                        </Text>
                    </>
                )}
            </span>
            <ChevronRightIcon width={16} height={16} className={ticket.icon} />
        </div>
    );
}
