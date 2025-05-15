import { FormBudgetRow } from "@/module/campaigns/component/Creation/NewCampaign/FormBudgetRow";
import { Panel } from "@/module/common/component/Panel";
import { FormDescription } from "@/module/forms/Form";
import type { Campaign } from "@/types/Campaign";
import { useCallback } from "react";
import type { UseFormReturn } from "react-hook-form";

export function FormBudget(form: UseFormReturn<Campaign>) {
    const type = form.watch("budget.type");
    const maxEuroDaily = Number(form.watch("budget.maxEuroDaily"));

    const calculateCostPerDay = useCallback(() => {
        const days = getNumberOfDays(type);
        return maxEuroDaily / days;
    }, [type, maxEuroDaily]);

    const costPerDay = calculateCostPerDay();
    const average = (costPerDay * 0.82).toFixed(2);
    const maxDaily = (costPerDay * 1.25).toFixed(2);
    const maxWeekly = (costPerDay * 7).toFixed(2);

    return (
        <Panel title="Budget">
            <FormDescription>
                The campaign budget will allocate this to your currently running
                ad sets for best results based on your choices and bidding
                strategy (performance target). You can control spending on a
                daily or global basis.
            </FormDescription>
            <FormBudgetRow {...form} />
            <FormDescription>
                {type && type !== "global" && maxEuroDaily > 0 && (
                    <>
                        You will spend an average of €{average} per day. Your
                        maximum daily spend is €{maxDaily} and your maximum
                        weekly spend is €{maxWeekly}.
                    </>
                )}
            </FormDescription>
        </Panel>
    );
}

export function getNumberOfDays(type: Campaign["budget"]["type"]) {
    switch (type) {
        case "daily":
            return 1;
        case "weekly":
            return 7;
        case "monthly":
            return 30;
        default:
            return 7;
    }
}
