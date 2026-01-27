import type { UseFormReturn } from "react-hook-form";
import type { CampaignFormValues } from "@/module/campaigns/component/Creation/NewCampaign/types";
import { FormDescription, FormItem } from "@/module/forms/Form";

/**
 * Display the campaign special advertising category
 * @param form
 * @constructor
 */
export function FormAdvertising(form: UseFormReturn<CampaignFormValues>) {
    const advertising = form.getValues("specialCategories");
    return (
        <FormItem>
            <FormDescription label={"Special advertising category"} />
            {advertising.length === 0 && (
                <p>
                    My campaign doesn't belong to any special advertising
                    category
                </p>
            )}
            {advertising.length > 0 &&
                advertising.map((item) => <p key={item}>{item}</p>)}
        </FormItem>
    );
}
