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
import { InputNumber } from "@module/component/forms/InputNumber";
import type { UseFormReturn } from "react-hook-form";

export function FormBudgetRow(
    form: UseFormReturn<Campaign> & {
        isCheckCampaign?: boolean;
        disabled?: boolean;
    }
) {
    const { isCheckCampaign, disabled } = form;

    return (
        <Row>
            <FormField
                control={form.control}
                name="budget.type"
                rules={{ required: "Select a budget" }}
                render={({ field }) => (
                    <FormItem>
                        {isCheckCampaign ? (
                            <FormDescription label={"Campaign budget"} />
                        ) : (
                            <FormLabel>Campaign budget</FormLabel>
                        )}
                        <FormMessage />
                        <Select
                            onValueChange={(value) => {
                                if (value === "") return;
                                field.onChange(value);
                            }}
                            value={field.value}
                            disabled={disabled}
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
                rules={{
                    validate: {
                        required: (value) => value > 0 || "Invalid amount",
                    },
                }}
                render={({ field }) => (
                    <FormItem>
                        <FormMessage />
                        <FormControl>
                            <InputNumber
                                placeholder={"25,00 €"}
                                length={"medium"}
                                rightSection={"EUR"}
                                disabled={disabled}
                                {...field}
                            />
                        </FormControl>
                    </FormItem>
                )}
            />
        </Row>
    );
}
