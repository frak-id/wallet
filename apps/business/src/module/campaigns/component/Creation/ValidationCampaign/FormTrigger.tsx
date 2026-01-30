import { Input } from "@frak-labs/ui/component/forms/Input";
import { capitalize } from "radash";
import { useFormContext } from "react-hook-form";
import { FormDescription, FormItem } from "@/module/forms/Form";
import type { CampaignDraft } from "@/stores/campaignStore";

export function FormTrigger() {
    const form = useFormContext<CampaignDraft>();
    const trigger = form.getValues("rule.trigger");
    return (
        <FormItem>
            <FormDescription label={"Trigger"} />
            {trigger && (
                <Input
                    length={"medium"}
                    disabled={true}
                    defaultValue={capitalize(trigger ?? "")}
                />
            )}
        </FormItem>
    );
}
