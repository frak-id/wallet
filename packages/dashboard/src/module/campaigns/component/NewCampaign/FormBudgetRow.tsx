import { Row } from "@/module/common/component/Row";
import {
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/module/forms/Form";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/module/forms/Select";
import type { Campaign } from "@/types/Campaign";
import { Input } from "@module/component/forms/Input";
import { useEffect, useState } from "react";
import type { UseFormReturn } from "react-hook-form";

export function FormBudgetRow(
    form: UseFormReturn<Campaign> & { isCheckCampaign?: boolean }
) {
    const { isCheckCampaign } = form;

    // Force refresh the form when reset the budget type
    const [forceRefresh, setForceRefresh] = useState(new Date().getTime());
    const watchBudgetType = form.watch("budget.type");

    /**
     * Reset budget type when the type is reset
     */
    useEffect(() => {
        if (watchBudgetType !== "") return;
        setForceRefresh(new Date().getTime());
        form.setValue("budget.type", undefined);
    }, [watchBudgetType, form]);

    return (
        <Row>
            <FormField
                key={forceRefresh}
                control={form.control}
                name="budget.type"
                render={({ field }) => (
                    <FormItem>
                        {isCheckCampaign ? (
                            <FormDescription title={"Campaign budget"} />
                        ) : (
                            <FormLabel>Campaign budget</FormLabel>
                        )}
                        <FormMessage />
                        <Select
                            onValueChange={field.onChange}
                            defaultValue={field.value}
                        >
                            <FormControl>
                                <SelectTrigger length={"medium"} {...field}>
                                    <SelectValue placeholder="Select a budget" />
                                </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                                <SelectItem value="daily">
                                    Daily budget
                                </SelectItem>
                                <SelectItem value="weekly">
                                    Weekly budget
                                </SelectItem>
                                <SelectItem value="monthly">
                                    Monthly budget
                                </SelectItem>
                                <SelectItem value="global">
                                    Global budget
                                </SelectItem>
                            </SelectContent>
                        </Select>
                    </FormItem>
                )}
            />
            <FormField
                control={form.control}
                name="budget.maxEuroDaily"
                rules={{ required: "Select an amount" }}
                render={({ field }) => (
                    <FormItem>
                        <FormMessage />
                        <FormControl>
                            <Input
                                placeholder={"25,00 €"}
                                length={"medium"}
                                rightSection={"EUR"}
                                {...field}
                            />
                        </FormControl>
                    </FormItem>
                )}
            />
        </Row>
    );
}
