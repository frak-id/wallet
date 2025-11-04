import type { UseFormReturn } from "react-hook-form";
import { FormDescription, FormItem } from "@/module/forms/Form";
import type { Campaign } from "@/types/Campaign";

/**
 * Display the campaign special advertising category
 * @param form
 * @constructor
 */
export function FormAdvertising(form: UseFormReturn<Campaign>) {
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
