import { capitalize } from "radash";
import { useFormContext } from "react-hook-form";
import { FormDescription, FormItem } from "@/module/forms/Form";
import { Input } from "@/module/forms/Input";
import type { CampaignDraft } from "@/stores/campaignStore";

export function FormGoal() {
    const form = useFormContext<CampaignDraft>();
    const goal = form.getValues("metadata.goal");
    return (
        <FormItem>
            <FormDescription label={"Campaign goal"} />
            {goal && (
                <Input
                    length={"medium"}
                    disabled={true}
                    defaultValue={capitalize(goal ?? "")}
                />
            )}
        </FormItem>
    );
}
