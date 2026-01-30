import { CircleDollarSign, Wallet } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useFormContext } from "react-hook-form";
import { getCapPeriod } from "@/module/campaigns/utils/capPeriods";
import { Column } from "@/module/common/component/Column";
import { InputAmount } from "@/module/common/component/InputAmount";
import { Row } from "@/module/common/component/Row";
import {
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/module/forms/Form";
import { RadioGroup, RadioGroupItem } from "@/module/forms/RadioGroup";
import type { CampaignDraft } from "@/stores/campaignStore";
import styles from "./FormBudgetRow.module.css";

type BudgetPeriod = "daily" | "weekly" | "monthly" | "global";

const periods: { value: BudgetPeriod; label: string }[] = [
    { value: "daily", label: "Daily" },
    { value: "weekly", label: "Weekly" },
    { value: "monthly", label: "Monthly" },
    { value: "global", label: "Global" },
];

export function FormBudgetRow({ disabled }: { disabled?: boolean }) {
    const { control, setValue, watch } = useFormContext<CampaignDraft>();
    const budgetConfig = watch("budgetConfig");
    const budget = budgetConfig?.[0];

    const [period, setPeriod] = useState<BudgetPeriod>("global");

    useEffect(() => {
        if (budget?.durationInSeconds) {
            const matched = periods.find(
                (p) => getCapPeriod(p.value) === budget.durationInSeconds
            );
            if (matched) setPeriod(matched.value);
        }
    }, [budget?.durationInSeconds]);

    const currentAmount = budget?.amount ?? 0;

    const updateBudget = (newPeriod: BudgetPeriod, newAmount: number) => {
        const duration = getCapPeriod(newPeriod);
        const label =
            periods.find((p) => p.value === newPeriod)?.label ?? "Global";

        setValue(
            "budgetConfig",
            [{ label, durationInSeconds: duration, amount: newAmount }],
            { shouldValidate: true, shouldDirty: true }
        );
    };

    const [frakCommission, remainingBudget] = useMemo(() => {
        const commission = currentAmount * 0.2;
        return [commission, currentAmount - commission];
    }, [currentAmount]);

    return (
        <Column>
            <FormItem>
                <FormDescription label="Budget Period" />
                <RadioGroup
                    value={period}
                    onValueChange={(val) => {
                        const newPeriod = val as BudgetPeriod;
                        setPeriod(newPeriod);
                        updateBudget(newPeriod, currentAmount);
                    }}
                    className={styles.periodGroup}
                >
                    <Row>
                        {periods.map((p) => (
                            <FormItem
                                key={p.value}
                                variant="radio"
                                className={styles.periodItem}
                            >
                                <FormControl>
                                    <RadioGroupItem
                                        value={p.value}
                                        disabled={disabled}
                                    />
                                </FormControl>
                                <FormLabel variant="radio">{p.label}</FormLabel>
                            </FormItem>
                        ))}
                    </Row>
                </RadioGroup>
            </FormItem>

            <Row>
                <FormField
                    control={control}
                    name="budgetConfig"
                    rules={{
                        validate: {
                            required: (value) =>
                                value?.[0]?.amount > 0 || "Invalid amount",
                        },
                    }}
                    render={() => (
                        <FormItem>
                            <FormDescription label="Budget Amount" />
                            <FormMessage />
                            <FormControl>
                                <InputAmount
                                    placeholder="25,00 €"
                                    length="medium"
                                    disabled={disabled}
                                    value={currentAmount}
                                    // @ts-expect-error - InputAmount expects ControllerRenderProps onChange
                                    onChange={(val: number | string) => {
                                        const num =
                                            typeof val === "number" ? val : 0;
                                        updateBudget(period, num);
                                    }}
                                    name="budgetAmount"
                                />
                            </FormControl>
                        </FormItem>
                    )}
                />
            </Row>

            <div>
                <div className={styles.budget__section}>
                    <div className={styles.budget__iconGroup}>
                        <div className={styles.budget__icon}>
                            <CircleDollarSign />
                        </div>
                        <span className={styles.budget__label}>
                            Frak commission (20%)
                        </span>
                    </div>
                    <div className={styles.budget__value}>
                        {frakCommission.toFixed(2)} €
                    </div>
                </div>

                <div className={styles.budget__divider} />

                <div className={styles.budget__section}>
                    <div className={styles.budget__iconGroup}>
                        <div className={styles.budget__icon}>
                            <Wallet />
                        </div>
                        <span className={styles.budget__label}>
                            Rewards distributed (80%)
                        </span>
                    </div>
                    <div className={styles.budget__value}>
                        {remainingBudget.toFixed(2)} €
                    </div>
                </div>
            </div>
        </Column>
    );
}
