import { FormDescription, FormItem } from "@/module/forms/Form";
import type { Campaign } from "@/types/Campaign";
import { Input } from "@frak-labs/ui/component/forms/Input";
import { capitalize } from "radash";
import type { UseFormReturn } from "react-hook-form";

/**
 * Display the campaign goal
 * @param form
 * @constructor
 */
export function FormGoal(form: UseFormReturn<Campaign>) {
    return (
        <FormItem>
            <FormDescription label={"Campaign goal"} />
            {form.getValues("type") && (
                <Input
                    length={"medium"}
                    disabled={true}
                    defaultValue={capitalize(form.getValues("type") ?? "")}
                />
            )}
        </FormItem>
    );
}
