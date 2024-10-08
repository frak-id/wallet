import { FormDescription, FormItem } from "@/module/forms/Form";
import type { Campaign } from "@/types/Campaign";
import { Input } from "@module/component/forms/Input";
import { capitalize } from "radash";
import type { UseFormReturn } from "react-hook-form";

/**
 * Display the campaign order
 * @param form
 * @constructor
 */
export function FormOrder(form: UseFormReturn<Campaign>) {
    return (
        <FormItem>
            <FormDescription label={"Type of order"} />
            <Input
                length={"medium"}
                disabled={true}
                defaultValue={capitalize(form.getValues("order"))}
            />
        </FormItem>
    );
}
