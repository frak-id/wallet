"use client";

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
import type { Campaign } from "@/types/Campaign";
import { getCountryDataList } from "countries-list";
import type { UseFormReturn } from "react-hook-form";

export function FormTerritory(form: UseFormReturn<Campaign>) {
    return (
        <Panel title="Territory">
            <FormField
                control={form.control}
                name="territories"
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
