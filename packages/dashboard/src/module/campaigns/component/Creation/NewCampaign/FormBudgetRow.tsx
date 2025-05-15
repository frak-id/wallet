import { Row } from "@/module/common/component/Row";
import {
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormMessage,
} from "@/module/forms/Form";
import type { Campaign } from "@/types/Campaign";
import { InputNumber } from "@shared/module/component/forms/InputNumber";
import { useMemo } from "react";
import { useFormContext } from "react-hook-form";
import { Column } from "../../../../common/component/Column";

export function FormBudgetRow({
    disabled,
}: {
    disabled?: boolean;
}) {
    const { control, watch } = useFormContext<Campaign>();

    const maxEuroDaily = watch("budget.maxEuroDaily");
    const [frakCommission, remainingBudget] = useMemo(() => {
        const commission = Number(maxEuroDaily) * 0.2;
        return [commission, Number(maxEuroDaily) - commission];
    }, [maxEuroDaily]);

    return (
        <Column>
            <Row>
                <FormDescription>Global budget:</FormDescription>
                <FormField
                    control={control}
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
            <Row>
                <FormDescription>
                    Frak commission: {frakCommission} €
                </FormDescription>
            </Row>
            <Row>
                <FormDescription>
                    Remaining budget: {remainingBudget} €
                </FormDescription>
            </Row>
        </Column>
    );
}
