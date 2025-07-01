import { Panel } from "@/module/common/component/Panel";
import {
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/module/forms/Form";
import type { Campaign } from "@/types/Campaign";
import { Checkbox } from "@frak-labs/ui/component/forms/Checkbox";
import type { UseFormReturn } from "react-hook-form";

export function FormScope(form: UseFormReturn<Campaign>) {
    return (
        <Panel title="Campaign Scope">
            <FormField
                control={form.control}
                name="scope.type"
                render={({ field }) => (
                    <FormItem>
                        <FormDescription>
                            Choose how your campaign will be triggered and
                            accessed by users.
                        </FormDescription>

                        <FormItem variant={"checkbox"}>
                            <FormControl>
                                <Checkbox
                                    checked={
                                        field.value === "global" || !field.value
                                    }
                                    onCheckedChange={(checked) => {
                                        if (checked) {
                                            field.onChange("global");
                                        }
                                    }}
                                />
                            </FormControl>
                            <FormLabel
                                variant={"checkbox"}
                                selected={
                                    field.value === "global" || !field.value
                                }
                            >
                                Global Campaign
                                <span
                                    style={{
                                        display: "block",
                                        fontSize: "0.875rem",
                                        color: "#6b7280",
                                        marginTop: "0.25rem",
                                    }}
                                >
                                    Automatically triggered for all users
                                    matching your campaign criteria. This is the
                                    default and recommended option for most
                                    campaigns.
                                </span>
                            </FormLabel>
                        </FormItem>

                        <FormItem variant={"checkbox"}>
                            <FormControl>
                                <Checkbox
                                    checked={field.value === "specific"}
                                    onCheckedChange={(checked) => {
                                        if (checked) {
                                            field.onChange("specific");
                                        }
                                    }}
                                />
                            </FormControl>
                            <FormLabel
                                variant={"checkbox"}
                                selected={field.value === "specific"}
                            >
                                Specific Campaign
                                <span
                                    style={{
                                        display: "block",
                                        fontSize: "0.875rem",
                                        color: "#6b7280",
                                        marginTop: "0.25rem",
                                    }}
                                >
                                    Requires users to access your campaign
                                    through a specific sharing link. Use this
                                    for targeted campaigns or special
                                    promotions.
                                </span>
                            </FormLabel>
                        </FormItem>

                        <FormMessage />
                    </FormItem>
                )}
            />
        </Panel>
    );
}
