import { Input } from "@frak-labs/ui/component/forms/Input";
import { capitalize } from "radash";
import { useFormContext } from "react-hook-form";
import { FormBudgetRow } from "@/module/campaigns/component/Creation/NewCampaign/FormBudgetRow";
import { FormAdvertising } from "@/module/campaigns/component/Creation/ValidationCampaign/FormAdvertising";
import { FormGoal } from "@/module/campaigns/component/Creation/ValidationCampaign/FormGoal";
import { Panel } from "@/module/common/component/Panel";
import { FormDescription, FormItem } from "@/module/forms/Form";
import type { CampaignDraft } from "@/stores/campaignStore";
import type { FixedRewardDefinition } from "@/types/Campaign";

export function FormCheck() {
    const form = useFormContext<CampaignDraft>();
    const { metadata, scheduled, rule, priority } = form.getValues();

    const territories = metadata.territories ?? [];
    const trigger = rule.trigger;
    const reward = rule.rewards?.[0] as FixedRewardDefinition | undefined;
    const rewardAmount = reward?.amount ?? 0;
    const rewardRecipient = reward?.recipient ?? "referrer";
    const rewardChaining = reward?.chaining;

    const formatDate = (date?: Date) => {
        if (!date) return "Not set";
        return new Intl.DateTimeFormat("en-US", {
            dateStyle: "medium",
            timeStyle: "short",
        }).format(new Date(date));
    };

    return (
        <Panel title="Check your campaign">
            <FormItem>
                <FormDescription label={"Campaign Title"} />
                <Input disabled={true} {...form.register("name")} />
            </FormItem>

            <FormGoal />

            <FormAdvertising />

            <FormItem>
                <FormDescription label={"Territories"} />
                <Input
                    disabled={true}
                    value={
                        territories.length > 0
                            ? territories.join(", ")
                            : "All territories"
                    }
                />
            </FormItem>

            <FormItem>
                <FormDescription label={"Schedule"} />
                <div style={{ display: "flex", gap: "1rem" }}>
                    <div style={{ flex: 1 }}>
                        <FormDescription label={"Start Date"} />
                        <Input
                            disabled={true}
                            value={formatDate(scheduled.startDate)}
                        />
                    </div>
                    {scheduled.endDate && (
                        <div style={{ flex: 1 }}>
                            <FormDescription label={"End Date"} />
                            <Input
                                disabled={true}
                                value={formatDate(scheduled.endDate)}
                            />
                        </div>
                    )}
                </div>
            </FormItem>

            <FormItem>
                <FormDescription label={"Trigger"} />
                <Input disabled={true} value={capitalize(trigger)} />
            </FormItem>

            <FormItem>
                <FormDescription label={"Priority"} />
                <Input disabled={true} value={priority.toString()} />
            </FormItem>

            <Panel title="Reward Configuration">
                <FormItem>
                    <FormDescription label={"Reward Amount"} />
                    <Input disabled={true} value={`${rewardAmount} EUR`} />
                </FormItem>
                <FormItem>
                    <FormDescription label={"Recipient"} />
                    <Input
                        disabled={true}
                        value={capitalize(rewardRecipient)}
                    />
                </FormItem>
                {rewardChaining && (
                    <FormItem>
                        <FormDescription label={"Chaining"} />
                        <Input
                            disabled={true}
                            value={`User: ${rewardChaining.userPercent}%, Decay: ${rewardChaining.deperditionPerLevel}%`}
                        />
                    </FormItem>
                )}
            </Panel>

            <FormBudgetRow disabled={true} />
        </Panel>
    );
}
