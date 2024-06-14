import type { FormCampaignsValidation } from "@/module/campaigns/component/ValidationCampaign/index";
import { Row } from "@/module/common/component/Row";
import {
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormMessage,
} from "@/module/forms/Form";
import { Input } from "@/module/forms/Input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/module/forms/Select";
import type { UseFormReturn } from "react-hook-form";

export function FormBudget(form: UseFormReturn<FormCampaignsValidation>) {
    return (
        <Row>
            <FormField
                control={form.control}
                name="budget"
                rules={{ required: "Select a budget" }}
                render={({ field }) => (
                    <FormItem>
                        <FormDescription title={"Campaign budget"} />
                        <FormMessage />
                        <Select
                            onValueChange={field.onChange}
                            defaultValue={field.value}
                        >
                            <FormControl>
                                <SelectTrigger {...field}>
                                    <SelectValue placeholder="Select a budget" />
                                </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                                <SelectItem value="daily">
                                    Daily budget
                                </SelectItem>
                                <SelectItem value="monthly">
                                    Monthly budget
                                </SelectItem>
                            </SelectContent>
                        </Select>
                    </FormItem>
                )}
            />
            <FormField
                control={form.control}
                name="budgetAmount"
                rules={{ required: "Select an amount" }}
                render={({ field }) => (
                    <FormItem>
                        <FormMessage />
                        <FormControl>
                            <Input
                                placeholder={"25,00 €"}
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
