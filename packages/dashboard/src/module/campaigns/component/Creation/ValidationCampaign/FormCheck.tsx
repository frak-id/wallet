import { CampaignPromotedContent } from "@/module/campaigns/component/CampaignDetails/CampaignPromotedContent";
import { FormBudgetRow } from "@/module/campaigns/component/Creation/NewCampaign/FormBudgetRow";
import { FormAdvertising } from "@/module/campaigns/component/Creation/ValidationCampaign/FormAdvertising";
import { FormGoal } from "@/module/campaigns/component/Creation/ValidationCampaign/FormGoal";
import { FormOrder } from "@/module/campaigns/component/Creation/ValidationCampaign/FormOrder";
import { FormPriceRange } from "@/module/campaigns/component/Creation/ValidationCampaign/FormPriceRange";
import { Panel } from "@/module/common/component/Panel";
import { FormDescription, FormItem } from "@/module/forms/Form";
import type { Campaign } from "@/types/Campaign";
import { Input } from "@module/component/forms/Input";
import type { UseFormReturn } from "react-hook-form";

export function FormCheck(form: UseFormReturn<Campaign>) {
    return (
        <Panel title="Check your campaign">
            <FormItem>
                <FormDescription label={"Campaign Title"} />
                <Input disabled={true} {...form.control.register("title")} />
            </FormItem>
            <FormAdvertising {...form} />
            <FormOrder {...form} />
            <FormGoal {...form} />
            <FormBudgetRow {...form} isCheckCampaign={true} />
            <FormPriceRange {...form} disabled={true} />
            <CampaignPromotedContent
                promotedContents={form.getValues("promotedContents") ?? []}
            />
        </Panel>
    );
}
