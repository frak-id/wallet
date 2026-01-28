import { Input } from "@frak-labs/ui/component/forms/Input";
import { capitalize } from "radash";
import { useFormContext } from "react-hook-form";
import { FormBudgetRow } from "@/module/campaigns/component/Creation/NewCampaign/FormBudgetRow";
import { FormAdvertising } from "@/module/campaigns/component/Creation/ValidationCampaign/FormAdvertising";
import { FormGoal } from "@/module/campaigns/component/Creation/ValidationCampaign/FormGoal";
import { RewardsSummary } from "@/module/campaigns/component/RewardsSummary";
import { Panel } from "@/module/common/component/Panel";
import { FormDescription, FormItem } from "@/module/forms/Form";
import type { CampaignDraft } from "@/stores/campaignStore";

export function FormCheck() {
    const form = useFormContext<CampaignDraft>();
    const { metadata, scheduled, rule } = form.getValues();

    const territories = metadata.territories ?? [];
    const trigger = rule.trigger;
    const rewards = rule.rewards ?? [];

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

            <RewardsSummary rewards={rewards} />

            <FormBudgetRow disabled={true} />
        </Panel>
    );
}
