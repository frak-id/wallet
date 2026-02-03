import { useFormContext } from "react-hook-form";
import { FormDescription, FormItem } from "@/module/forms/Form";
import type { CampaignDraft } from "@/stores/campaignStore";
import type { SpecialCategory } from "@/types/Campaign";

export function FormAdvertising() {
    const form = useFormContext<CampaignDraft>();
    const advertising: SpecialCategory[] =
        form.getValues("metadata.specialCategories") ?? [];
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
                advertising.map((item: SpecialCategory) => (
                    <p key={item}>{item}</p>
                ))}
        </FormItem>
    );
}
