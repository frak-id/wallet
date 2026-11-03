import type { Stablecoin } from "@frak-labs/app-essentials";
import type {
    BankOwed,
    FrakBank as FrakBankData,
} from "@frak-labs/backend-elysia/orchestration/schemas";
import { Badge } from "@frak-labs/design-system/components/Badge";
import { Card } from "@frak-labs/design-system/components/Card";
import {
    createDataTableColumnHelper,
    DataTable,
} from "@frak-labs/design-system/components/DataTable";
import { Inline } from "@frak-labs/design-system/components/Inline";
import { Notice } from "@frak-labs/design-system/components/Notice";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import { RefreshIcon } from "@frak-labs/design-system/icons";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import type { TFunction } from "i18next";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/module/common/component/Button";
import { formatTokenBalance } from "@/module/common/utils/currencyOptions";
import { frakBankQueryOptions, useRecheckBank } from "../api";
import { formatDateTime, formatEur } from "../format";
import { twoColumns } from "../internal.css";
import { PayoutBadge } from "./StatusBadges";
import { Details, ErrorNotice, ExplorerLink, Panel } from "./ui";

type Token = FrakBankData["tokens"][number];
type MerchantLine = FrakBankData["merchants"][number];
type Prize = FrakBankData["prizes"][number];

function amountOf(wei: string, symbol: Stablecoin, decimals: number) {
    return formatTokenBalance(BigInt(wei), symbol, decimals);
}

/** `12 € · 3` — an owed bucket with how many rewards it holds. */
function owedLabel(
    bucket: BankOwed["due"],
    symbol: Stablecoin,
    decimals: number,
    t: TFunction
) {
    if (bucket.count === 0) return "—";
    return t("internal.bank.owedValue", {
        amount: amountOf(bucket.amount, symbol, decimals),
        count: bucket.count,
    });
}

export function FrakBank() {
    const { t, i18n } = useTranslation();
    const {
        data: bank,
        refetch,
        isFetching,
    } = useSuspenseQuery(frakBankQueryOptions());
    const recheck = useRecheckBank();
    const short = bank.tokens.filter((token) => BigInt(token.shortfall) > 0n);

    return (
        <Stack space="xl">
            <Panel
                title={t("internal.bank.title")}
                badge={
                    <Badge
                        size="small"
                        variant={bank.isOpen ? "success" : "error"}
                    >
                        {bank.isOpen
                            ? t("internal.bank.open")
                            : t("internal.bank.closed")}
                    </Badge>
                }
                description={t("internal.bank.description")}
                actions={
                    <Inline space="s">
                        <Button
                            variant="secondary"
                            size="small"
                            icon={<RefreshIcon width={16} height={16} />}
                            loading={isFetching}
                            onClick={() => refetch()}
                        >
                            {t("internal.bank.reload")}
                        </Button>
                        <Button
                            size="small"
                            loading={recheck.isPending}
                            onClick={() => recheck.mutate()}
                        >
                            {t("internal.bank.recheck.trigger")}
                        </Button>
                    </Inline>
                }
            >
                <Details
                    rows={[
                        [
                            t("internal.bank.address"),
                            <ExplorerLink
                                kind="address"
                                value={bank.address}
                            />,
                        ],
                        [
                            t("internal.bank.checkedAt"),
                            formatDateTime(bank.checkedAt, i18n.language),
                        ],
                    ]}
                />
                {recheck.data && (
                    <Notice tone="success" role="status">
                        {t("internal.bank.recheck.result", {
                            count: recheck.data.requeued,
                        })}
                    </Notice>
                )}
                <ErrorNotice error={recheck.error} />
                {short.map((token) => (
                    <Notice key={token.symbol} tone="error" role="alert">
                        {t("internal.bank.shortfall", {
                            amount: amountOf(
                                token.shortfall,
                                token.symbol,
                                token.decimals
                            ),
                        })}
                    </Notice>
                ))}
                {!bank.isOpen && (
                    <Notice tone="error">
                        {t("internal.bank.closedHint")}
                    </Notice>
                )}
                <Text variant="caption" color="tertiary">
                    {t("internal.bank.recheck.hint")}
                </Text>
            </Panel>
            <div className={twoColumns}>
                {bank.tokens.map((token) => (
                    <TokenCard key={token.symbol} token={token} />
                ))}
            </div>
            <MerchantsTable merchants={bank.merchants} tokens={bank.tokens} />
            <PrizesTable prizes={bank.prizes} />
        </Stack>
    );
}

function TokenCard({ token }: { token: Token }) {
    const { t } = useTranslation();
    const { symbol, decimals, owed } = token;
    const amount = (wei: string) => amountOf(wei, symbol, decimals);
    const short = BigInt(token.shortfall) > 0n;

    return (
        <Panel
            title={symbol.toUpperCase()}
            badge={
                <Badge size="small" variant={short ? "error" : "success"}>
                    {short
                        ? t("internal.bank.token.short", {
                              amount: amount(token.shortfall),
                          })
                        : t("internal.bank.token.covered")}
                </Badge>
            }
        >
            <Details
                rows={[
                    [t("internal.bank.token.balance"), amount(token.balance)],
                    [
                        t("internal.bank.token.allowance"),
                        amount(token.allowance),
                    ],
                    [t("internal.bank.token.payable"), amount(token.payable)],
                    [
                        t("internal.bank.owed.due"),
                        owedLabel(owed.due, symbol, decimals, t),
                    ],
                    [
                        t("internal.bank.owed.depleted"),
                        owedLabel(owed.depleted, symbol, decimals, t),
                    ],
                    [
                        t("internal.bank.owed.processing"),
                        owedLabel(owed.processing, symbol, decimals, t),
                    ],
                    [
                        t("internal.bank.owed.later"),
                        owedLabel(owed.later, symbol, decimals, t),
                    ],
                ]}
            />
        </Panel>
    );
}

const merchantColumns = createDataTableColumnHelper<MerchantLine>();

function MerchantsTable({
    merchants,
    tokens,
}: {
    merchants: MerchantLine[];
    tokens: Token[];
}) {
    const { t } = useTranslation();
    const columns = useMemo(() => {
        const decimalsOf = (symbol: Stablecoin) =>
            tokens.find((token) => token.symbol === symbol)?.decimals ?? 18;
        const bucket = (key: keyof BankOwed) =>
            merchantColumns.display({
                id: key,
                header: t(`internal.bank.owed.${key}`),
                cell: ({ row }) =>
                    owedLabel(
                        row.original.owed[key],
                        row.original.symbol,
                        decimalsOf(row.original.symbol),
                        t
                    ),
                meta: { align: "right" },
            });
        return merchantColumns.columns([
            merchantColumns.accessor("name", {
                header: t("internal.bank.merchants.merchant"),
                cell: ({ row }) => (
                    <Stack space="none">
                        <Text variant="bodySmall" weight="medium">
                            {row.original.name || row.original.merchantId}
                        </Text>
                        <Text variant="caption" color="secondary">
                            {row.original.domain}
                        </Text>
                    </Stack>
                ),
            }),
            merchantColumns.accessor("symbol", {
                header: t("internal.bank.merchants.token"),
                cell: ({ getValue }) => getValue().toUpperCase(),
            }),
            bucket("due"),
            bucket("depleted"),
            bucket("processing"),
            bucket("later"),
        ]);
    }, [t, tokens]);

    return (
        <Stack space="s">
            <Text as="h2" variant="heading3">
                {t("internal.bank.merchants.title")}
            </Text>
            <Card radius="m" padding="none">
                <DataTable
                    data={merchants}
                    columns={columns}
                    emptyMessage={t("internal.bank.merchants.empty")}
                />
            </Card>
        </Stack>
    );
}

const prizeColumns = createDataTableColumnHelper<Prize>();

function PrizesTable({ prizes }: { prizes: Prize[] }) {
    const { t, i18n } = useTranslation();
    const navigate = useNavigate();
    const locale = i18n.language;
    const columns = useMemo(
        () =>
            prizeColumns.columns([
                prizeColumns.accessor("prizeAmount", {
                    header: t("internal.bank.prizes.prize"),
                    cell: ({ row }) => (
                        <Stack space="none">
                            <Text variant="bodySmall" weight="medium">
                                {formatEur(row.original.prizeAmount, locale)}
                            </Text>
                            <Text variant="caption" color="secondary">
                                {t("internal.bank.prizes.ended", {
                                    date: formatDateTime(
                                        row.original.endsAt,
                                        locale
                                    ),
                                })}
                            </Text>
                        </Stack>
                    ),
                }),
                prizeColumns.accessor("confirmedAt", {
                    header: t("internal.bank.prizes.confirmedAt"),
                    cell: ({ getValue }) => formatDateTime(getValue(), locale),
                    sortFn: "datetime",
                }),
                prizeColumns.display({
                    id: "payout",
                    header: t("internal.bank.prizes.payout"),
                    cell: ({ row }) => <PayoutCell prize={row.original} />,
                }),
            ]),
        [t, locale]
    );

    return (
        <Stack space="s">
            <Text as="h2" variant="heading3">
                {t("internal.bank.prizes.title")}
            </Text>
            <Card radius="m" padding="none">
                <DataTable
                    data={prizes}
                    columns={columns}
                    emptyMessage={t("internal.bank.prizes.empty")}
                    onRowClick={(row) =>
                        navigate({
                            to: "/internal/game/$gameId",
                            params: { gameId: row.original.gameId },
                        })
                    }
                />
            </Card>
        </Stack>
    );
}

function PayoutCell({ prize }: { prize: Prize }) {
    const { t } = useTranslation();
    const { payout } = prize;
    if (!payout) {
        return (
            <Text variant="caption" color="tertiary">
                {t("internal.payout.missing")}
            </Text>
        );
    }
    return (
        <Stack space="xxs">
            <Inline space="xs" alignY="center">
                <PayoutBadge status={payout.status} />
                {payout.txHash && (
                    <ExplorerLink kind="tx" value={payout.txHash} />
                )}
            </Inline>
            {payout.lastError && (
                <Text variant="caption" color="error">
                    {payout.lastError}
                </Text>
            )}
        </Stack>
    );
}
