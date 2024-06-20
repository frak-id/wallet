import { Panel } from "@/module/common/component/Panel";
import { Row } from "@/module/common/component/Row";
import {
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
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
        <Panel title="Budget">
            <FormDescription>
                The campaign budget will allocate this to your currently running
                ad sets for best results based on your choices and bidding
                strategy (performance target). You can control spending on a
                daily or global basis.
            </FormDescription>
            <Row>
                <FormField
                    control={form.control}
                    name="budget.type"
                    rules={{ required: "Select a budget" }}
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Campaign budget</FormLabel>
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
            <FormDescription>
                You will spend an average of €25 per day. Your maximum daily
                spend is €31.25 and your maximum weekly spend is €175.
            </FormDescription>
        </Panel>
    );
}
