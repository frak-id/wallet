"use client";

import type { FormCampaignsNew } from "@/module/campaigns/component/NewCampaign";
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
import { getCountryDataList } from "countries-list";
import type { UseFormReturn } from "react-hook-form";

export function FormTerritory(form: UseFormReturn<FormCampaignsNew>) {
    return (
        <Panel title="Territory">
            <FormField
                control={form.control}
                name="territory"
                rules={{ required: "Select a country" }}
                render={({ field }) => (
                    <FormItem>
                        <FormDescription>
                            Choose a or several countries where your campaign
                            will be displayed.
                        </FormDescription>
                        <FormLabel>Location</FormLabel>
                        <FormControl>
                            <MultiSelect
                                options={getCountryDataList()}
                                onValueChange={field.onChange}
                                defaultValue={field.value}
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
