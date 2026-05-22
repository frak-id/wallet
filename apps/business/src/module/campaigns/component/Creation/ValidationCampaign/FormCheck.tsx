import {
    Card,
    CardHeader,
    CardTitle,
} from "@frak-labs/design-system/components/Card";
import { Inline } from "@frak-labs/design-system/components/Inline";
import { capitalize } from "radash";
import { useFormContext } from "react-hook-form";
import { FormBudgetRow } from "@/module/campaigns/component/Creation/NewCampaign/FormBudgetRow";
import { FormAdvertising } from "@/module/campaigns/component/Creation/ValidationCampaign/FormAdvertising";
import { FormGoal } from "@/module/campaigns/component/Creation/ValidationCampaign/FormGoal";
import { RewardsSummary } from "@/module/campaigns/component/RewardsSummary";
import { FormDescription, FormItem } from "@/module/forms/Form";
import { Input } from "@/module/forms/Input";
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
        <Card>
            <CardHeader>
                <CardTitle>Check your campaign</CardTitle>
            </CardHeader>
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
                <Inline space="m" fill>
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
                </Inline>
            </FormItem>

            <FormItem>
                <FormDescription label={"Trigger"} />
                <Input disabled={true} value={capitalize(trigger)} />
            </FormItem>

            <RewardsSummary rewards={rewards} />

            <FormBudgetRow disabled={true} />
        </Card>
    );
}
