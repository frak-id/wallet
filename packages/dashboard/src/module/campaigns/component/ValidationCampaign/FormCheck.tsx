import { FormBudgetRow } from "@/module/campaigns/component/NewCampaign/FormBudgetRow";
import { FormObjectives } from "@/module/campaigns/component/ValidationCampaign/FormObjectives";
import { FormPromotedContent } from "@/module/campaigns/component/ValidationCampaign/FormPromotedContent";
import { Panel } from "@/module/common/component/Panel";
import { FormDescription, FormItem } from "@/module/forms/Form";
import { Input } from "@/module/forms/Input";
import type { Campaign } from "@/types/Campaign";
import type { UseFormReturn } from "react-hook-form";

export function FormCheck(form: UseFormReturn<Campaign>) {
    const advertising = form.getValues("specialCategories");
    return (
        <Panel title="Check your campaign">
            <FormItem>
                <FormDescription title={"Campaign Title"} />
                <Input disabled={true} {...form.control.register("title")} />
            </FormItem>
            <FormItem>
                <FormDescription title={"Special advertising category"} />
                {advertising.length === 0 && (
                    <p>
                        My campaign doesn’t belong to any special advertising
                        category
                    </p>
                )}
                {advertising.length > 0 &&
                    advertising.map((item) => <p key={item}>{item}</p>)}
            </FormItem>
            <FormItem>
                <FormDescription title={"Type of order"} />
                <Input
                    length={"medium"}
                    disabled={true}
                    {...form.control.register("order")}
                />
            </FormItem>
            <FormItem>
                <FormDescription title={"Campaign goal"} />
                <Input
                    length={"medium"}
                    disabled={true}
                    {...form.control.register("type")}
                />
            </FormItem>
            <FormBudgetRow {...form} isCheckCampaign={true} />
            <FormObjectives {...form} />
            <FormPromotedContent {...form} />
        </Panel>
    );
}
