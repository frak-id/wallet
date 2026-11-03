import type { FrakCode } from "@frak-labs/backend-elysia/orchestration/schemas";
import { Badge } from "@frak-labs/design-system/components/Badge";
import {
    createDataTableColumnHelper,
    DataTable,
} from "@frak-labs/design-system/components/DataTable";
import {
    Dialog,
    DialogContent,
    DialogTitle,
    DialogTrigger,
} from "@frak-labs/design-system/components/Dialog";
import { Inline } from "@frak-labs/design-system/components/Inline";
import { Input } from "@frak-labs/design-system/components/Input";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import { QrCodeIcon } from "@frak-labs/design-system/icons";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/module/common/component/Button";
import { LinkButton } from "@/module/common/component/LinkButton";
import {
    frakCodesQueryOptions,
    useIssueFrakCode,
    useRevokeFrakCode,
} from "../api";
import { formatDateTime } from "../format";
import { codeCell, qrDialog } from "../internal.css";
import { FrakCodeQr } from "./QrCode";
import { ActionForm, ConfirmAction, ErrorNotice, Panel } from "./ui";

export function ReferralCodes() {
    const { data: codes } = useSuspenseQuery(frakCodesQueryOptions());
    return (
        <Stack space="l">
            <IssueCodeCard />
            <CodesTable codes={codes} />
        </Stack>
    );
}

function IssueCodeCard() {
    const { t } = useTranslation();
    const [vanity, setVanity] = useState("");
    const issue = useIssueFrakCode();

    return (
        <Panel
            title={t("internal.codes.issue.title")}
            description={t("internal.codes.issue.description")}
        >
            <ActionForm
                onSubmit={() =>
                    issue.mutate(vanity.trim() || undefined, {
                        onSuccess: () => setVanity(""),
                    })
                }
            >
                <Inline space="s" alignY="bottom" wrap>
                    <Input
                        label={t("internal.codes.issue.vanityLabel")}
                        placeholder={t(
                            "internal.codes.issue.vanityPlaceholder"
                        )}
                        value={vanity}
                        maxLength={6}
                        onChange={(e) =>
                            setVanity(e.target.value.toUpperCase())
                        }
                    />
                    <Button type="submit" loading={issue.isPending}>
                        {vanity
                            ? t("internal.codes.issue.submitVanity")
                            : t("internal.codes.issue.submitRandom")}
                    </Button>
                </Inline>
            </ActionForm>
            <ErrorNotice error={issue.error} />
            {issue.data && (
                <Stack space="s">
                    <Text variant="heading3" className={codeCell}>
                        {issue.data.code}
                    </Text>
                    <FrakCodeQr code={issue.data.code} />
                </Stack>
            )}
        </Panel>
    );
}

const columnHelper = createDataTableColumnHelper<FrakCode>();

function CodesTable({ codes }: { codes: FrakCode[] }) {
    const { t, i18n } = useTranslation();
    const columns = useMemo(
        () =>
            columnHelper.columns([
                columnHelper.accessor("code", {
                    header: t("internal.codes.table.code"),
                    cell: ({ getValue }) => (
                        <span className={codeCell}>{getValue()}</span>
                    ),
                }),
                columnHelper.accessor("revokedAt", {
                    header: t("internal.codes.table.status"),
                    cell: ({ getValue }) => (
                        <Badge
                            variant={getValue() ? "disabled" : "success"}
                            size="small"
                        >
                            {getValue()
                                ? t("internal.codes.status.revoked")
                                : t("internal.codes.status.active")}
                        </Badge>
                    ),
                }),
                columnHelper.accessor("activeReferees", {
                    header: t("internal.codes.table.redemptions"),
                    cell: ({ row }) =>
                        t("internal.codes.table.redemptionsValue", {
                            active: row.original.activeReferees,
                            total: row.original.redemptions,
                        }),
                    meta: { align: "right" },
                }),
                columnHelper.accessor("gameId", {
                    header: t("internal.codes.table.game"),
                    cell: ({ getValue }) => {
                        const gameId = getValue();
                        return gameId ? (
                            <LinkButton
                                to="/internal/game/$gameId"
                                params={{ gameId }}
                                variant="ghost"
                                size="small"
                            >
                                {t("internal.codes.table.viewGame")}
                            </LinkButton>
                        ) : (
                            "—"
                        );
                    },
                    enableSorting: false,
                }),
                columnHelper.accessor("createdAt", {
                    header: t("internal.codes.table.createdAt"),
                    cell: ({ getValue }) =>
                        formatDateTime(getValue(), i18n.language),
                    sortFn: "datetime",
                }),
                columnHelper.display({
                    id: "actions",
                    cell: ({ row }) => <CodeActions code={row.original} />,
                    meta: { align: "right" },
                }),
            ]),
        [t, i18n.language]
    );

    return (
        <Panel title={t("internal.codes.table.title", { count: codes.length })}>
            <DataTable
                data={codes}
                columns={columns}
                emptyMessage={t("internal.codes.table.empty")}
            />
        </Panel>
    );
}

function CodeActions({ code }: { code: FrakCode }) {
    const { t } = useTranslation();
    const revoke = useRevokeFrakCode();

    return (
        <Inline space="xs" align="right">
            <Dialog>
                <DialogTrigger asChild>
                    <Button
                        variant="ghost"
                        size="small"
                        icon={<QrCodeIcon width={16} height={16} />}
                    >
                        {t("internal.codes.showQr")}
                    </Button>
                </DialogTrigger>
                <DialogContent className={qrDialog}>
                    <Stack space="m" align="center">
                        <DialogTitle>{code.code}</DialogTitle>
                        <FrakCodeQr code={code.code} />
                    </Stack>
                </DialogContent>
            </Dialog>
            {!code.revokedAt && (
                <ConfirmAction
                    trigger={
                        <Button variant="secondary" size="small">
                            {t("internal.codes.revoke.trigger")}
                        </Button>
                    }
                    title={t("internal.codes.revoke.title", {
                        code: code.code,
                    })}
                    description={
                        code.gameId
                            ? t("internal.codes.revoke.descriptionGame")
                            : t("internal.codes.revoke.description")
                    }
                    confirmLabel={t("internal.codes.revoke.confirm")}
                    destructive
                    mutation={revoke}
                    variables={code.code}
                />
            )}
        </Inline>
    );
}
