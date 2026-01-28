import { getCountryDataList } from "countries-list";
import { useFormContext } from "react-hook-form";
import { Panel } from "@/module/common/component/Panel";
import {
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/module/forms/Form";
import { MultiSelect } from "@/module/forms/MultiSelect";
import type { CampaignDraft } from "@/stores/campaignStore";

export function FormTerritory() {
    const { control } = useFormContext<CampaignDraft>();

    return (
        <Panel title="Territory">
            <FormField
                control={control}
                name="metadata.territories"
                rules={{ required: "Select a country" }}
                render={({ field }) => (
                    <FormItem>
                        <FormDescription>
                            Choose one or several countries where your campaign
                            will be displayed.
                        </FormDescription>
                        <FormLabel>Location</FormLabel>
                        <FormControl>
                            <MultiSelect
                                options={getCountryDataList()}
                                onValueChange={(value) => {
                                    const countries = value
                                        .map((v) => v.name)
                                        .filter(Boolean);
                                    field.onChange(countries);
                                }}
                                placeholder="Select country"
                                {...field}
                            />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                )}
            />
        </Panel>
    );
}
