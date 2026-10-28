import type { DrawRejectionReason } from "@frak-labs/backend-elysia/domain/game/schemas";
import type {
    GameAdmin,
    GameDrawAdmin,
} from "@frak-labs/backend-elysia/orchestration/schemas";
import { Badge } from "@frak-labs/design-system/components/Badge";
import { Card } from "@frak-labs/design-system/components/Card";
import { Inline } from "@frak-labs/design-system/components/Inline";
import { Notice } from "@frak-labs/design-system/components/Notice";
import { Skeleton } from "@frak-labs/design-system/components/Skeleton";
import { Spread } from "@frak-labs/design-system/components/Spread";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import {
    CheckCircleFilledIcon,
    ExclamationCircleIcon,
    RefreshIcon,
} from "@frak-labs/design-system/icons";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/module/common/component/Button";
import {
    drawVerificationQueryOptions,
    gameDrawQueryOptions,
    publicDrawUrl,
    useConfirmWinner,
    useFreezeDraw,
    useRejectCandidate,
} from "../api";
import { formatCount, formatDateTime, shortId } from "../format";
import { linkButton, mono, twoColumns } from "../internal.css";
import { PlayerLink } from "./PlayersTable";
import { DrawStatusBadge, FollowBadge } from "./StatusBadges";
import { ConfirmAction, Details, ErrorNotice, OptionSelect, Panel } from "./ui";

const REJECTION_REASONS: DrawRejectionReason[] = [
    "not_verified_in_time",
    "not_following_at_review",
    "fraud",
    "unreachable",
    "ineligible",
];

export function DrawPanel({ game }: { game: GameAdmin }) {
    const { t } = useTranslation();
    const {
        data: draw,
        isPending,
        error,
        refetch,
        isFetching,
    } = useQuery(gameDrawQueryOptions(game.id));

    return (
        <Panel
            title={t("internal.draw.title")}
            badge={draw && <DrawStatusBadge status={draw.status} />}
            actions={
                draw && (
                    <Button
                        variant="secondary"
                        size="small"
                        icon={<RefreshIcon width={16} height={16} />}
                        loading={isFetching}
                        onClick={() => refetch()}
                    >
                        {t("internal.draw.reload")}
                    </Button>
                )
            }
        >
            {isPending && <Skeleton height={120} />}
            <ErrorNotice error={error} />
            {!isPending && !error && !draw && <FreezeNow gameId={game.id} />}
            {draw && <DrawDetails gameId={game.id} draw={draw} />}
        </Panel>
    );
}

function FreezeNow({ gameId }: { gameId: string }) {
    const { t } = useTranslation();
    const freeze = useFreezeDraw(gameId);
    return (
        <Stack space="s">
            <Text variant="bodySmall" color="secondary">
                {t("internal.draw.notFrozen")}
            </Text>
            <Inline space="s">
                <ConfirmAction
                    trigger={
                        <Button>{t("internal.draw.freeze.trigger")}</Button>
                    }
                    title={t("internal.draw.freeze.title")}
                    description={t("internal.draw.freeze.description")}
                    confirmLabel={t("internal.draw.freeze.confirm")}
                    mutation={freeze}
                    variables={undefined}
                />
            </Inline>
        </Stack>
    );
}

function DrawDetails({
    gameId,
    draw,
}: {
    gameId: string;
    draw: GameDrawAdmin;
}) {
    const { t, i18n } = useTranslation();
    const locale = i18n.language;
    return (
        <Stack space="l">
            <div className={twoColumns}>
                <Details
                    rows={[
                        [
                            t("internal.draw.frozenAt"),
                            formatDateTime(draw.frozenAt, locale),
                        ],
                        [
                            t("internal.draw.participants"),
                            t("internal.draw.participantsValue", {
                                eligible: draw.eligibleParticipants,
                                total: draw.participants,
                            }),
                        ],
                        [
                            t("internal.draw.tickets"),
                            formatCount(draw.totalTickets, locale),
                        ],
                        [
                            t("internal.draw.candidates"),
                            t("internal.draw.candidatesValue", {
                                rejected: draw.rejections.length,
                                total: draw.candidates,
                            }),
                        ],
                    ]}
                />
                <Details
                    rows={[
                        [
                            t("internal.draw.round"),
                            `#${draw.drand.round} · ${formatDateTime(draw.drand.roundTime, locale)}`,
                        ],
                        [
                            t("internal.draw.beacon"),
                            <Badge
                                size="small"
                                variant={draw.drand.signed ? "success" : "info"}
                            >
                                {draw.drand.signed
                                    ? t("internal.draw.beaconSigned")
                                    : t("internal.draw.beaconWaiting")}
                            </Badge>,
                        ],
                        [
                            t("internal.draw.root"),
                            <span className={mono} title={draw.snapshotRoot}>
                                {shortId(draw.snapshotRoot, 10, 6)}
                            </span>,
                        ],
                        [
                            t("internal.draw.algorithm"),
                            <span className={mono}>{draw.algorithm}</span>,
                        ],
                    ]}
                />
            </div>
            {draw.candidate && (
                <CandidateReview
                    gameId={gameId}
                    candidate={draw.candidate}
                    candidateWindow={draw.candidateWindow}
                />
            )}
            {draw.winner && <WinnerNotice winner={draw.winner} />}
            {draw.rejections.length > 0 && (
                <Rejections rejections={draw.rejections} />
            )}
            <Verification gameId={gameId} />
        </Stack>
    );
}

function CandidateReview({
    gameId,
    candidate,
    candidateWindow,
}: {
    gameId: string;
    candidate: NonNullable<GameDrawAdmin["candidate"]>;
    candidateWindow: boolean;
}) {
    const { t, i18n } = useTranslation();
    const locale = i18n.language;
    const confirm = useConfirmWinner(gameId);
    const { instagram } = candidate;
    const ready = candidate.awaiting === "admin";
    const notToldYet = ready ? "—" : t("internal.draw.candidate.notToldYet");

    return (
        <Card variant="muted" radius="m">
            <Stack space="m">
                <Spread space="s">
                    <Text as="h3" variant="heading5">
                        {t("internal.draw.candidate.title", {
                            rank: candidate.rank + 1,
                        })}
                    </Text>
                    <Badge size="small" variant={ready ? "success" : "warning"}>
                        {ready
                            ? t("internal.draw.candidate.awaitingAdmin")
                            : t("internal.draw.candidate.awaitingPlayer")}
                    </Badge>
                </Spread>
                {!instagram.followFresh && (
                    <Notice tone="warning">
                        {t("internal.draw.candidate.metaDown")}
                    </Notice>
                )}
                <div className={twoColumns}>
                    <Details
                        rows={[
                            [
                                t("internal.draw.candidate.player"),
                                <PlayerLink
                                    wallet={candidate.wallet}
                                    identityGroupId={candidate.identityGroupId}
                                />,
                            ],
                            [
                                t("internal.draw.candidate.accountCreated"),
                                formatDateTime(
                                    candidate.accountCreatedAt,
                                    locale
                                ),
                            ],
                            [
                                t("internal.draw.candidate.tickets"),
                                formatCount(candidate.drawTickets, locale),
                            ],
                            [
                                t("internal.draw.candidate.pid"),
                                <span className={mono}>
                                    {shortId(candidate.pid, 8, 4)}
                                </span>,
                            ],
                        ]}
                    />
                    <Details
                        rows={[
                            [
                                t("internal.game.players.instagram"),
                                `${instagram.username ? `@${instagram.username}` : "—"} · ${t(`internal.instagram.${instagram.level}`)}`,
                            ],
                            [
                                t("internal.draw.candidate.follows"),
                                <FollowBadge follows={instagram.follows} />,
                            ],
                            [
                                t("internal.draw.candidate.checkedAt"),
                                formatDateTime(instagram.checkedAt, locale),
                            ],
                            [
                                t("internal.draw.candidate.verifyBy"),
                                candidate.verifyBy
                                    ? formatDateTime(candidate.verifyBy, locale)
                                    : notToldYet,
                            ],
                        ]}
                    />
                </div>
                <Text variant="caption" color="secondary">
                    {candidateWindow
                        ? t("internal.draw.candidate.windowHint")
                        : t("internal.draw.candidate.adminOnlyHint")}
                </Text>
                <Inline space="s" wrap>
                    <RejectCandidate gameId={gameId} />
                    <ConfirmAction
                        trigger={
                            <Button disabled={!ready}>
                                {t("internal.draw.confirm.trigger")}
                            </Button>
                        }
                        title={t("internal.draw.confirm.title")}
                        description={t("internal.draw.confirm.description")}
                        confirmLabel={t("internal.draw.confirm.confirm")}
                        mutation={confirm}
                        variables={undefined}
                    />
                </Inline>
            </Stack>
        </Card>
    );
}

/** The reason picker sits outside the dialog: Radix renders its description as a `<p>`. */
function RejectCandidate({ gameId }: { gameId: string }) {
    const { t } = useTranslation();
    const [reason, setReason] = useState<DrawRejectionReason>("fraud");
    const reject = useRejectCandidate(gameId);
    return (
        <Inline space="xs" alignY="center">
            <OptionSelect
                label={t("internal.draw.reject.reason")}
                labelHidden
                value={reason}
                onChange={setReason}
                options={REJECTION_REASONS.map((value) => ({
                    value,
                    label: t(`internal.draw.reason.${value}`),
                }))}
            />
            <ConfirmAction
                trigger={
                    <Button variant="secondary">
                        {t("internal.draw.reject.trigger")}
                    </Button>
                }
                title={t("internal.draw.reject.title")}
                description={t("internal.draw.reject.description", {
                    reason: t(`internal.draw.reason.${reason}`),
                })}
                confirmLabel={t("internal.draw.reject.confirm")}
                destructive
                mutation={reject}
                variables={reason}
            />
        </Inline>
    );
}

function WinnerNotice({
    winner,
}: {
    winner: NonNullable<GameDrawAdmin["winner"]>;
}) {
    const { t, i18n } = useTranslation();
    return (
        <Notice tone="success" display="block">
            <Stack space="xxs">
                <Text variant="bodySmall" weight="semiBold">
                    {t("internal.draw.winner.title")}
                </Text>
                <Inline space="xs" alignY="center">
                    <PlayerLink
                        wallet={winner.wallet}
                        identityGroupId={winner.identityGroupId}
                    />
                    <Text variant="caption" color="secondary">
                        {t("internal.draw.winner.confirmedBy", {
                            actor: winner.confirmedBy ?? "?",
                            date: formatDateTime(
                                winner.confirmedAt,
                                i18n.language
                            ),
                        })}
                    </Text>
                </Inline>
            </Stack>
        </Notice>
    );
}

function Rejections({
    rejections,
}: {
    rejections: GameDrawAdmin["rejections"];
}) {
    const { t, i18n } = useTranslation();
    return (
        <Stack space="xs">
            <Text as="h3" variant="heading5">
                {t("internal.draw.rejections")}
            </Text>
            {rejections.map((rejection) => (
                <Text key={rejection.pid} variant="bodySmall" color="secondary">
                    {t("internal.draw.rejection", {
                        rank: rejection.rank + 1,
                        reason: t(`internal.draw.reason.${rejection.reason}`),
                        actor: rejection.actor,
                        date: formatDateTime(rejection.at, i18n.language),
                    })}
                </Text>
            ))}
        </Stack>
    );
}

function Verification({ gameId }: { gameId: string }) {
    const { t } = useTranslation();
    const [requested, setRequested] = useState(false);
    const { data, isFetching, error, refetch } = useQuery({
        ...drawVerificationQueryOptions(gameId),
        enabled: requested,
    });
    const allGood = data?.every((check) => check.ok);

    return (
        <Stack space="s">
            <Spread space="s">
                <Text as="h3" variant="heading5">
                    {t("internal.draw.verify.title")}
                </Text>
                <Inline space="s" alignY="center">
                    <a
                        className={linkButton}
                        href={publicDrawUrl(gameId)}
                        target="_blank"
                        rel="noreferrer"
                    >
                        {t("internal.draw.verify.publicRecord")}
                    </a>
                    <Button
                        variant="secondary"
                        size="small"
                        loading={isFetching}
                        onClick={() =>
                            requested ? refetch() : setRequested(true)
                        }
                    >
                        {t("internal.draw.verify.run")}
                    </Button>
                </Inline>
            </Spread>
            <ErrorNotice error={error} />
            {data && (
                <Stack space="xxs">
                    <Notice tone={allGood ? "success" : "error"}>
                        {allGood
                            ? t("internal.draw.verify.allGood")
                            : t("internal.draw.verify.failed")}
                    </Notice>
                    {data.map((check) => (
                        <Inline key={check.id} space="xs" alignY="center">
                            {check.ok ? (
                                <CheckCircleFilledIcon width={16} height={16} />
                            ) : (
                                <ExclamationCircleIcon width={16} height={16} />
                            )}
                            <Text
                                variant="bodySmall"
                                color={check.ok ? "primary" : "error"}
                            >
                                {t(`internal.draw.check.${check.id}`)}
                            </Text>
                        </Inline>
                    ))}
                </Stack>
            )}
        </Stack>
    );
}
