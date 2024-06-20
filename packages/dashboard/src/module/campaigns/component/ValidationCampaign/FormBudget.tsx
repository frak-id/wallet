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
import type { Campaign } from "@/types/Campaign";
import type { UseFormReturn } from "react-hook-form";

export function FormBudget(form: UseFormReturn<Campaign>) {
    return (
        <Row>
            <FormField
                control={form.control}
                name="budget.type"
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
                name="budget.maxEuroDaily"
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
