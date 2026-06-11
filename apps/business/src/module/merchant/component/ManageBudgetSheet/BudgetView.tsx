import { Button } from "@frak-labs/design-system/components/Button";
import { Card } from "@frak-labs/design-system/components/Card";
import { Inline } from "@frak-labs/design-system/components/Inline";
import { Spinner } from "@frak-labs/design-system/components/Spinner";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Switch } from "@frak-labs/design-system/components/Switch";
import { Text } from "@frak-labs/design-system/components/Text";
import { InfoIcon, PlusIcon } from "@frak-labs/design-system/icons";
import { useTranslation } from "react-i18next";
import type { Address } from "viem";
import { CallOut } from "@/module/common/component/CallOut";
import { Tooltip } from "@/module/common/component/Tooltip";
import { useGetMerchantBank } from "@/module/merchant/hook/useGetMerchantBank";
import { useSetBankOpenStatus } from "@/module/merchant/hook/useSetBankOpenStatus";
import { useSyncMerchantBank } from "@/module/merchant/hook/useSyncMerchantBank";
import {
    type BudgetToken,
    splitTokensByFunding,
} from "@/module/merchant/utils/budgetTokens";
import { LegacyBankMigration } from "./LegacyBankMigration";
import * as styles from "./manage-budget-sheet.css";
import { EmptyTokenCard, FundedTokenCard } from "./TokenCard";

export function BudgetView({
    merchantId,
    onAddFunds,
}: {
    merchantId: string;
    onAddFunds: () => void;
}) {
    const { t } = useTranslation();
    const { data, isLoading, isError } = useGetMerchantBank({ merchantId });

    if (isLoading) {
        return (
            <div className={styles.centered}>
                <Spinner />
            </div>
        );
    }

    if (isError || !data) {
        return <p className={styles.errorText}>{t("funding.error")}</p>;
    }

    if (!data.deployed || !data.bankAddress) {
        return <SetupBudget merchantId={merchantId} />;
    }

    return (
        <BudgetContent
            merchantId={merchantId}
            bankAddress={data.bankAddress}
            isManager={data.isManager}
            isOpen={data.isOpen ?? false}
            tokens={data.tokens}
            onAddFunds={onAddFunds}
        />
    );
}

function SetupBudget({ merchantId }: { merchantId: string }) {
    const { t } = useTranslation();
    const { mutate: syncBank, isPending } = useSyncMerchantBank({ merchantId });

    return (
        <Card radius="m">
            <Stack space="xs">
                <Text variant="body" color="secondary">
                    {t("funding.setup.description")}
                </Text>
                <Button
                    size="large"
                    width="auto"
                    loading={isPending}
                    disabled={isPending}
                    onClick={() => syncBank()}
                >
                    {t("funding.setup.cta")}
                </Button>
            </Stack>
        </Card>
    );
}

function BudgetContent({
    merchantId,
    bankAddress,
    isManager,
    isOpen,
    tokens,
    onAddFunds,
}: {
    merchantId: string;
    bankAddress: Address;
    isManager: boolean;
    isOpen: boolean;
    tokens: BudgetToken[];
    onAddFunds: () => void;
}) {
    const { t } = useTranslation();
    const { funded, empty } = splitTokensByFunding(tokens);
    const allTokensEmpty = funded.length === 0;

    return (
        <Stack space="l">
            <LegacyBankMigration
                merchantId={merchantId}
                newBankAddress={bankAddress}
            />

            {allTokensEmpty && isOpen && (
                <CallOut variant="warning">
                    {t("funding.budget.emptyWarning")}
                </CallOut>
            )}

            <Stack space="xs">
                <Text
                    variant="bodySmall"
                    weight="medium"
                    color="secondary"
                    as="span"
                >
                    {t("funding.budget.sectionLabel")}
                </Text>

                {isManager && (
                    <DistributionCell
                        merchantId={merchantId}
                        bankAddress={bankAddress}
                        isOpen={isOpen}
                    />
                )}
            </Stack>

            {funded.length > 0 && (
                <Stack space="m">
                    {funded.map((token) => (
                        <FundedTokenCard
                            key={token.address}
                            token={token}
                            merchantId={merchantId}
                            bankAddress={bankAddress}
                            isManager={isManager}
                            isBankOpen={isOpen}
                        />
                    ))}
                </Stack>
            )}

            {empty.length > 0 && (
                <Inline space="m" alignY="top" wrap={false}>
                    {empty.map((token) => (
                        <EmptyTokenCard key={token.address} token={token} />
                    ))}
                </Inline>
            )}

            <Inline space="none" align="center">
                <Button
                    size="large"
                    width="auto"
                    icon={<PlusIcon width={24} height={24} />}
                    onClick={onAddFunds}
                >
                    {t("funding.budget.addFunds")}
                </Button>
            </Inline>
        </Stack>
    );
}

function DistributionCell({
    merchantId,
    bankAddress,
    isOpen,
}: {
    merchantId: string;
    bankAddress: Address;
    isOpen: boolean;
}) {
    const { t } = useTranslation();
    const { setOpenStatus, isSettingOpenStatus } = useSetBankOpenStatus({
        bankAddress,
        merchantId,
    });

    return (
        <div className={styles.cell}>
            <Inline as="span" space="xxs" alignY="center" wrap={false}>
                <Text variant="body" weight="medium" color="primary" as="span">
                    {t("funding.budget.distributing")}
                </Text>
                <Tooltip content={t("funding.budget.distributingTooltip")}>
                    <InfoIcon className={styles.infoIcon} />
                </Tooltip>
            </Inline>
            <Switch
                checked={isOpen}
                disabled={isSettingOpenStatus}
                onCheckedChange={(checked) =>
                    setOpenStatus({ isOpen: checked })
                }
            />
        </div>
    );
}
