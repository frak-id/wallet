import { FormDescription, FormItem } from "@/module/forms/Form";
import { TriggerConfigurationDetails } from "../Generic/TriggerConfigurationDetails";

export function FormPriceRange() {
    return (
        <FormItem>
            <FormDescription label={"CPA Configuration"} />
            <TriggerConfigurationDetails />
        </FormItem>
    );
}
