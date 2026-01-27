import { Input } from "@frak-labs/ui/component/forms/Input";
import { capitalize } from "radash";
import type { UseFormReturn } from "react-hook-form";
import type { CampaignFormValues } from "@/module/campaigns/component/Creation/NewCampaign/types";
import { FormDescription, FormItem } from "@/module/forms/Form";

/**
 * Display the campaign goal
 * @param form
 * @constructor
 */
export function FormGoal(form: UseFormReturn<CampaignFormValues>) {
    return (
        <FormItem>
            <FormDescription label={"Campaign goal"} />
            {form.getValues("goal") && (
                <Input
                    length={"medium"}
                    disabled={true}
                    defaultValue={capitalize(form.getValues("goal") ?? "")}
                />
            )}
        </FormItem>
    );
}
