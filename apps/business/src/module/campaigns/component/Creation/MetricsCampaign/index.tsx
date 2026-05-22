import {
    Card,
    CardHeader,
    CardTitle,
} from "@frak-labs/design-system/components/Card";
import { Inline } from "@frak-labs/design-system/components/Inline";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Switch } from "@frak-labs/design-system/components/Switch";
import { Text } from "@frak-labs/design-system/components/Text";
import { useNavigate } from "@tanstack/react-router";
import { useMemo } from "react";
import { useForm, useWatch } from "react-hook-form";
import { Actions } from "@/module/campaigns/component/Actions";
import { ButtonCancel } from "@/module/campaigns/component/Creation/NewCampaign/ButtonCancel";
import { useSaveCampaign } from "@/module/campaigns/hook/useSaveCampaign";
import { Head } from "@/module/common/component/Head";
import { useActiveMerchantId } from "@/module/common/hook/useActiveMerchantId";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLayout,
} from "@/module/forms/Form";
import { type CampaignDraft, campaignStore } from "@/stores/campaignStore";
import type { CampaignTrigger } from "@/types/Campaign";
import { CacInput } from "./CacInput";
import { ChainingConfig } from "./ChainingConfig";
import { DistributionSlider } from "./DistributionSlider";
import { LockupConfig } from "./LockupConfig";
import { MinPurchaseAmount } from "./MinPurchaseAmount";
import * as styles from "./metrics-campaign.css";
import { TriggerSelector } from "./TriggerSelector";
import {
    DEFAULT_REWARD_STATE,
    extractFormStateFromRule,
    type RewardFormState,
    updateRuleWithRewards,
} from "./utils";

type MetricsFormValues = {
    trigger: CampaignTrigger;
} & RewardFormState;

function draftToFormValues(draft: CampaignDraft): MetricsFormValues {
    const rewardState =
        draft.rule.rewards.length > 0
            ? extractFormStateFromRule(draft.rule)
            : DEFAULT_REWARD_STATE;

    return {
        trigger: draft.rule.trigger,
        ...rewardState,
    };
}

function formValuesToDraft(
    values: MetricsFormValues,
    currentDraft: CampaignDraft
): CampaignDraft {
    const updatedRule = updateRuleWithRewards(currentDraft.rule, values);
    return {
        ...currentDraft,
        referralOnly: values.referralOnly,
        minPurchaseAmount: values.minPurchaseAmount,
        rule: {
            ...updatedRule,
            trigger: values.trigger,
        },
    };
}

export function MetricsCampaign() {
    const navigate = useNavigate();
    const merchantId = useActiveMerchantId();
    const draft = campaignStore((s) => s.draft);
    const updateDraft = campaignStore((s) => s.updateDraft);
    const saveCampaign = useSaveCampaign();

    const defaultValues = useMemo(() => draftToFormValues(draft), [draft]);

    const form = useForm<MetricsFormValues>({
        defaultValues,
        values: defaultValues,
    });

    const watchedTrigger = useWatch({
        control: form.control,
        name: "trigger",
    });
    const goal = campaignStore((s) => s.draft.metadata.goal);
    const showConditionsPanel =
        goal === "sales" && watchedTrigger === "purchase";

    async function onSubmit(values: MetricsFormValues) {
        const updatedDraft = formValuesToDraft(values, draft);
        updateDraft(() => updatedDraft);
        const saved = await saveCampaign.mutateAsync(updatedDraft);
        navigate({
            to: "/m/$merchantId/campaigns/draft/$campaignId/validation",
            params: { merchantId, campaignId: saved.id },
        });
    }

    const handleSaveDraft = form.handleSubmit(
        async (values: MetricsFormValues) => {
            const updatedDraft = formValuesToDraft(values, draft);
            updateDraft(() => updatedDraft);
            await saveCampaign.mutateAsync(updatedDraft);
        }
    );

    return (
        <FormLayout>
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)}>
                    <Head
                        title={{ content: "Campaign Rules", size: "small" }}
                        rightSection={
                            <ButtonCancel
                                onClick={() => form.reset(defaultValues)}
                            />
                        }
                    />

                    <Card>
                        <CardHeader>
                            <CardTitle>Campaign type</CardTitle>
                        </CardHeader>
                        <Stack space="m">
                            <Inline
                                space="m"
                                align="space-between"
                                alignY="center"
                            >
                                <Stack space="xxs">
                                    <span className={styles.chainingTitle}>
                                        Referral campaign
                                    </span>
                                    <Text
                                        as="span"
                                        variant="bodySmall"
                                        color="secondary"
                                    >
                                        Only reward users who were referred by
                                        another user
                                    </Text>
                                </Stack>
                                <FormField
                                    control={form.control}
                                    name="referralOnly"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormControl>
                                                <Switch
                                                    checked={
                                                        field.value ?? true
                                                    }
                                                    onCheckedChange={
                                                        field.onChange
                                                    }
                                                />
                                            </FormControl>
                                        </FormItem>
                                    )}
                                />
                            </Inline>
                        </Stack>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Set a target cost per action</CardTitle>
                        </CardHeader>
                        <p className={styles.panelDescription}>
                            "Target CPA" defines your overall acquisition cost
                            per target action (your goal) to generate the
                            maximum number of conversions at a cost equal to or
                            lower than the target cost per action you set.
                        </p>
                        <CacInput />
                        <TriggerSelector />
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Set reward amounts</CardTitle>
                        </CardHeader>
                        <p className={styles.panelDescription}>
                            When your goal is reached, the rewards are
                            distributed instantly and automatically to the
                            business introducer and the new customer, directly
                            into their wallets, in the set proportions.
                        </p>
                        <DistributionSlider />
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Referral Chain</CardTitle>
                        </CardHeader>
                        <ChainingConfig />
                    </Card>

                    {showConditionsPanel && (
                        <Card>
                            <CardHeader>
                                <CardTitle>Conditions</CardTitle>
                            </CardHeader>
                            <p className={styles.panelDescription}>
                                Filter which purchases qualify for a reward.
                            </p>
                            <MinPurchaseAmount />
                        </Card>
                    )}

                    <Card>
                        <CardHeader>
                            <CardTitle>Reward lockup</CardTitle>
                        </CardHeader>
                        <p className={styles.panelDescription}>
                            Rewards stay locked for a grace period after a
                            purchase before being settled on-chain. This
                            protects the campaign budget against refunds. Set to
                            0 to settle immediately.
                        </p>
                        <LockupConfig />
                    </Card>

                    <Actions
                        isLoading={saveCampaign.isPending}
                        onSaveDraft={handleSaveDraft}
                        isSaving={saveCampaign.isPending}
                        isSaved={saveCampaign.isSuccess}
                    />
                </form>
            </Form>
        </FormLayout>
    );
}
