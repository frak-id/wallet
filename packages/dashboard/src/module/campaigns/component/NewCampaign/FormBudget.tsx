import { FormBudgetRow } from "@/module/campaigns/component/NewCampaign/FormBudgetRow";
import { Panel } from "@/module/common/component/Panel";
import { FormDescription } from "@/module/forms/Form";
import type { Campaign } from "@/types/Campaign";
import type { UseFormReturn } from "react-hook-form";

export function FormBudget(form: UseFormReturn<Campaign>) {
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
                You will spend an average of €25 per day. Your maximum daily
                spend is €31.25 and your maximum weekly spend is €175.
            </FormDescription>
        </Panel>
    );
}
