import { Badge } from "@frak-labs/design-system/components/Badge";
import { Card } from "@frak-labs/design-system/components/Card";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import {
    DEFAULT_INACTIVITY_DAYS,
    periodTitle,
    progressionLabel,
} from "@/module/campaigns/component/Creation/RewardCampaign/subscription";
import type {
    CampaignRuleDefinition,
    RewardDefinition,
} from "@/types/Campaign";
import * as styles from "./campaign-details-sheet.css";
import { DefinitionRow, ValueText } from "./DefinitionRow";
import { Section } from "./parts";
import { RewardValue } from "./RewardValue";

const RECIPIENTS = ["referrer", "referee"] as const;

type Cycles = NonNullable<RewardDefinition["cycles"]>;
type SubscriptionRule = NonNullable<CampaignRuleDefinition["subscription"]>;

/** A stored range named like the wizard's periods: "Payment 1", "Rewards 2 to 5". */
function cycleLabel(
    t: TFunction,
    cycles: Cycles,
    subscription: SubscriptionRule,
    planEnd: number
): string {
    return periodTitle(
        t,
        subscription.stepBy ?? "cycle",
        cycles,
        cycles.from === 1 && cycles.to === planEnd
    );
}

function RecipientPlan({
    recipient,
    rewards,
    subscription,
    currency,
}: {
    recipient: (typeof RECIPIENTS)[number];
    rewards: RewardDefinition[];
    subscription: SubscriptionRule;
    currency: string;
}) {
    const { t } = useTranslation();
    const ranged = rewards
        .flatMap((reward) =>
            reward.cycles ? [{ reward, cycles: reward.cycles }] : []
        )
        .sort((a, b) => a.cycles.from - b.cycles.from);
    const planEnd = Math.max(0, ...ranged.map((r) => r.cycles.to));
    return (
        <Card radius="m">
            <Stack space="s">
                <div className={styles.rewardHeader}>
                    <Badge
                        variant={recipient === "referrer" ? "info" : "success"}
                        size="small"
                    >
                        {t(
                            `campaigns.details.config.rewards.recipient.${recipient}`
                        )}
                    </Badge>
                    <Text variant="caption" color="tertiary">
                        {t(
                            `campaigns.details.config.rewards.recipientHint.${recipient}`
                        )}
                    </Text>
                </div>
                <div>
                    {ranged.map(({ reward, cycles }) => (
                        <DefinitionRow
                            key={`${cycles.from}-${cycles.to}`}
                            label={cycleLabel(t, cycles, subscription, planEnd)}
                        >
                            <RewardValue reward={reward} currency={currency} />
                        </DefinitionRow>
                    ))}
                </div>
            </Stack>
        </Card>
    );
}

/** Rewards of a subscription campaign by plan step, plus its inactivity window. */
export function SubscriptionRewardsSection({
    rewards,
    subscription,
    currency,
    currencyGlyph,
}: {
    rewards: RewardDefinition[];
    subscription: SubscriptionRule;
    currency: string;
    currencyGlyph: string;
}) {
    const { t } = useTranslation();
    return (
        <Section title={t("campaigns.details.config.subscription.title")}>
            <Stack space="m">
                {rewards.length === 0 && (
                    <Card radius="m">
                        <Text variant="bodySmall" color="secondary">
                            {t("campaigns.details.config.rewards.empty")}
                        </Text>
                    </Card>
                )}
                {RECIPIENTS.map((recipient) => {
                    const own = rewards.filter(
                        (r) => r.recipient === recipient
                    );
                    return own.length > 0 ? (
                        <RecipientPlan
                            key={recipient}
                            recipient={recipient}
                            rewards={own}
                            subscription={subscription}
                            currency={currency}
                        />
                    ) : null;
                })}
                <Card radius="m">
                    <DefinitionRow
                        label={t(
                            "campaigns.details.config.subscription.progression.label"
                        )}
                    >
                        <ValueText>
                            {progressionLabel(t, subscription, currencyGlyph)}
                        </ValueText>
                    </DefinitionRow>
                    <DefinitionRow
                        label={t(
                            "campaigns.details.config.subscription.inactivity"
                        )}
                    >
                        <ValueText>
                            {t(
                                "campaigns.details.config.subscription.inactivityValue",
                                {
                                    count:
                                        subscription.inactivityDays ??
                                        DEFAULT_INACTIVITY_DAYS,
                                }
                            )}
                        </ValueText>
                    </DefinitionRow>
                </Card>
            </Stack>
        </Section>
    );
}
