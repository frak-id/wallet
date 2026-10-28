import type {
    FrakGameSetup,
    FrakRuleSummary,
} from "@frak-labs/backend-elysia/orchestration/schemas";
import { Badge } from "@frak-labs/design-system/components/Badge";
import { Input } from "@frak-labs/design-system/components/Input";
import { ProgressBar } from "@frak-labs/design-system/components/ProgressBar";
import { Spread } from "@frak-labs/design-system/components/Spread";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
    gameSetupQueryOptions,
    usePublishSignupRule,
    useSeedFrakMerchant,
} from "../api";
import { formatEur, shortId } from "../format";
import { formGrid, mono, twoColumns } from "../internal.css";
import {
    ActionForm,
    AmountInput,
    Details,
    FormActions,
    Panel,
    useFields,
} from "./ui";

export function GameSetup() {
    const { data } = useSuspenseQuery(gameSetupQueryOptions());
    return (
        <div className={twoColumns}>
            <MerchantCard merchant={data.merchant} />
            <SignupRuleCard
                rules={data.signupRules}
                merchantReady={data.merchant !== null}
            />
        </div>
    );
}

function ReadyBadge({ ready }: { ready: boolean }) {
    const { t } = useTranslation();
    return (
        <Badge variant={ready ? "success" : "warning"} size="small">
            {ready ? t("internal.setup.ready") : t("internal.setup.missing")}
        </Badge>
    );
}

function MerchantCard({ merchant }: { merchant: FrakGameSetup["merchant"] }) {
    const { t } = useTranslation();
    return (
        <Panel
            title={t("internal.setup.merchant.title")}
            badge={<ReadyBadge ready={merchant !== null} />}
            description={!merchant && t("internal.setup.merchant.description")}
        >
            {merchant ? (
                <Details
                    rows={[
                        [t("internal.setup.merchant.domain"), merchant.domain],
                        [
                            t("internal.setup.merchant.bank"),
                            <span className={mono}>
                                {merchant.bankAddress
                                    ? shortId(merchant.bankAddress)
                                    : "—"}
                            </span>,
                        ],
                    ]}
                />
            ) : (
                <SeedMerchantForm />
            )}
        </Panel>
    );
}

function SeedMerchantForm() {
    const { t } = useTranslation();
    const seed = useSeedFrakMerchant();
    const { values, bind } = useFields(() => ({ domain: "", owner: "" }));
    return (
        <ActionForm
            onSubmit={() =>
                seed.mutate({
                    domain: values.domain,
                    owner: values.owner.trim() || undefined,
                })
            }
        >
            <Input
                label={t("internal.setup.merchant.domain")}
                placeholder="frak.id"
                required
                {...bind("domain")}
            />
            <Input
                label={t("internal.setup.merchant.owner")}
                hint={t("internal.setup.merchant.ownerHint")}
                {...bind("owner")}
            />
            <FormActions
                mutation={seed}
                submitLabel={t("internal.setup.merchant.submit")}
            />
        </ActionForm>
    );
}

function SignupRuleCard({
    rules,
    merchantReady,
}: {
    rules: FrakRuleSummary[];
    merchantReady: boolean;
}) {
    const { t } = useTranslation();
    const live = rules.some((rule) => rule.status === "active");
    return (
        <Panel
            title={t("internal.setup.signupRule.title")}
            badge={<ReadyBadge ready={live} />}
            description={
                !live &&
                (merchantReady
                    ? t("internal.setup.signupRule.description")
                    : t("internal.setup.signupRule.needsMerchant"))
            }
        >
            {rules.map((rule) => (
                <RuleSummary key={rule.id} rule={rule} />
            ))}
            {live ? (
                <Text variant="caption" color="tertiary">
                    {t("internal.setup.signupRule.pauseHint")}
                </Text>
            ) : (
                <SignupRuleForm disabled={!merchantReady} />
            )}
        </Panel>
    );
}

function RuleSummary({ rule }: { rule: FrakRuleSummary }) {
    const { t, i18n } = useTranslation();
    return (
        <Stack space="xs">
            <Spread space="s">
                <Text variant="bodySmall" weight="medium">
                    {rule.rewards
                        .map((reward) =>
                            t("internal.rule.reward", {
                                recipient: t(
                                    `internal.rule.recipient.${reward.recipient}`,
                                    { defaultValue: reward.recipient }
                                ),
                                amount: formatEur(reward.amount, i18n.language),
                            })
                        )
                        .join(" · ")}
                </Text>
                <Badge
                    variant={rule.status === "active" ? "success" : "warning"}
                    size="small"
                >
                    {t(`internal.rule.status.${rule.status}`)}
                </Badge>
            </Spread>
            <BudgetBar budget={rule.budget} />
        </Stack>
    );
}

export function BudgetBar({ budget }: { budget: FrakRuleSummary["budget"] }) {
    const { t, i18n } = useTranslation();
    const { total, used } = budget;
    return (
        <Stack space="xxs">
            {total !== null && (
                <ProgressBar
                    value={total > 0 ? (used / total) * 100 : 0}
                    label={t("internal.rule.budget")}
                />
            )}
            <Text variant="caption" color="secondary">
                {t("internal.rule.budgetValue", {
                    used: formatEur(used, i18n.language),
                    total:
                        total === null
                            ? t("internal.rule.unlimited")
                            : formatEur(total, i18n.language),
                })}
            </Text>
        </Stack>
    );
}

function SignupRuleForm({ disabled }: { disabled: boolean }) {
    const { t } = useTranslation();
    const publish = usePublishSignupRule();
    const { values, bind } = useFields(() => ({
        referrer: "",
        referee: "",
        budget: "",
        unlockDays: "30",
    }));
    return (
        <ActionForm
            onSubmit={() =>
                publish.mutate({
                    referrer: Number(values.referrer),
                    referee: Number(values.referee),
                    budget: Number(values.budget),
                    unlockDays: Number(values.unlockDays),
                })
            }
        >
            <div className={formGrid}>
                <AmountInput
                    label={t("internal.setup.signupRule.referrer")}
                    {...bind("referrer")}
                />
                <AmountInput
                    label={t("internal.setup.signupRule.referee")}
                    {...bind("referee")}
                />
                <AmountInput
                    label={t("internal.form.budget")}
                    {...bind("budget")}
                />
                <AmountInput
                    label={t("internal.form.unlockDays")}
                    step="1"
                    {...bind("unlockDays")}
                />
            </div>
            <FormActions
                mutation={publish}
                submitLabel={t("internal.setup.signupRule.submit")}
                stepUp
                disabled={disabled}
            />
        </ActionForm>
    );
}
