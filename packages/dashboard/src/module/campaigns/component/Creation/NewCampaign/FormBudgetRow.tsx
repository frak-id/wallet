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
import { CircleDollarSign, Wallet } from "lucide-react";
import { useMemo } from "react";
import { useFormContext } from "react-hook-form";
import { Column } from "../../../../common/component/Column";
import styles from "./FormBudgetRow.module.css";

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
                            <FormDescription label={"Global budget"} />
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
            <div>
                <div className={styles.budget__section}>
                    <div className={styles.budget__iconGroup}>
                        <div className={`${styles.budget__icon}`}>
                            <CircleDollarSign />
                        </div>
                        <span className={styles.budget__label}>
                            Frak commission (20%)
                        </span>
                    </div>
                    <div className={`${styles.budget__value}`}>
                        {frakCommission.toFixed(2)} €
                    </div>
                </div>

                <div className={styles.budget__divider} />

                <div className={styles.budget__section}>
                    <div className={styles.budget__iconGroup}>
                        <div className={`${styles.budget__icon}`}>
                            <Wallet />
                        </div>
                        <span className={styles.budget__label}>
                            Rewards distributed to your customers (80%)
                        </span>
                    </div>
                    <div className={`${styles.budget__value}`}>
                        {remainingBudget.toFixed(2)} €
                    </div>
                </div>
            </div>
        </Column>
    );
}
