import { Input } from "@frak-labs/ui/component/forms/Input";
import type { UseFormReturn } from "react-hook-form";
import { FormBudgetRow } from "@/module/campaigns/component/Creation/NewCampaign/FormBudgetRow";
import { FormAdvertising } from "@/module/campaigns/component/Creation/ValidationCampaign/FormAdvertising";
import { FormGoal } from "@/module/campaigns/component/Creation/ValidationCampaign/FormGoal";
import { Panel } from "@/module/common/component/Panel";
import { FormDescription, FormItem } from "@/module/forms/Form";
import type { Campaign } from "@/types/Campaign";
import { FormPriceRange } from "./FormPriceRange";

export function FormCheck(form: UseFormReturn<Campaign>) {
    return (
        <Panel title="Check your campaign">
            <FormItem>
                <FormDescription label={"Campaign Title"} />
                <Input disabled={true} {...form.control.register("title")} />
            </FormItem>
            <FormAdvertising {...form} />
            <FormGoal {...form} />
            <FormBudgetRow disabled={true} />
            <FormPriceRange />
        </Panel>
    );
}
