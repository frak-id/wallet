import { Switch } from "@frak-labs/ui/component/Switch";
import { useNavigate } from "@tanstack/react-router";
import { useMemo } from "react";
import { useForm } from "react-hook-form";
import { Actions } from "@/module/campaigns/component/Actions";
import { ButtonCancel } from "@/module/campaigns/component/Creation/NewCampaign/ButtonCancel";
import { useSaveCampaign } from "@/module/campaigns/hook/useSaveCampaign";
import { Head } from "@/module/common/component/Head";
import { Panel } from "@/module/common/component/Panel";
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
import styles from "./index.module.css";
import { LockupConfig } from "./LockupConfig";
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
        rule: {
            ...updatedRule,
            trigger: values.trigger,
        },
    };
}

export function MetricsCampaign() {
    const navigate = useNavigate();
    const draft = campaignStore((s) => s.draft);
    const updateDraft = campaignStore((s) => s.updateDraft);
    const saveCampaign = useSaveCampaign();

    const defaultValues = useMemo(() => draftToFormValues(draft), [draft]);

    const form = useForm<MetricsFormValues>({
        defaultValues,
        values: defaultValues,
    });

    async function onSubmit(values: MetricsFormValues) {
        const updatedDraft = formValuesToDraft(values, draft);
        updateDraft(() => updatedDraft);
        const saved = await saveCampaign.mutateAsync(updatedDraft);
        navigate({
            to: "/campaigns/draft/$campaignId/validation",
            params: { campaignId: saved.id },
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

                    <Panel title="Campaign type">
                        <div className={styles.chaining}>
                            <div className={styles.chaining__header}>
                                <div className={styles.chaining__headerText}>
                                    <span className={styles.chaining__title}>
                                        Referral campaign
                                    </span>
                                    <span
                                        className={styles.chaining__description}
                                    >
                                        Only reward users who were referred by
                                        another user
                                    </span>
                                </div>
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
                            </div>
                        </div>
                    </Panel>

                    <Panel title="Set a target cost per action">
                        <p className={styles.panelDescription}>
                            "Target CPA" defines your overall acquisition cost
                            per target action (your goal) to generate the
                            maximum number of conversions at a cost equal to or
                            lower than the target cost per action you set.
                        </p>
                        <CacInput />
                        <TriggerSelector />
                    </Panel>

                    <Panel title="Set reward amounts">
                        <p className={styles.panelDescription}>
                            When your goal is reached, the rewards are
                            distributed instantly and automatically to the
                            business introducer and the new customer, directly
                            into their wallets, in the set proportions.
                        </p>
                        <DistributionSlider />
                    </Panel>

                    <Panel title="Referral Chain">
                        <ChainingConfig />
                    </Panel>

                    <Panel title="Reward lockup">
                        <p className={styles.panelDescription}>
                            Rewards stay locked for a grace period after a
                            purchase before being settled on-chain. This
                            protects the campaign budget against refunds. Set to
                            0 to settle immediately.
                        </p>
                        <LockupConfig />
                    </Panel>

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
