import { CircleDollarSign, Wallet } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useFormContext } from "react-hook-form";
import { getCapPeriod } from "@/module/campaigns/utils/capPeriods";
import { Column } from "@/module/common/component/Column";
import { InputAmount } from "@/module/common/component/InputAmount";
import { Row } from "@/module/common/component/Row";
import { tokenAddressToCurrency } from "@/module/common/utils/currencyOptions";
import {
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/module/forms/Form";
import type { InputNumberProps } from "@/module/forms/InputNumber";
import { RadioGroup, RadioGroupItem } from "@/module/forms/RadioGroup";
import type { CampaignDraft } from "@/stores/campaignStore";
import { currencyStore } from "@/stores/currencyStore";
import * as styles from "./form-budget-row.css";

type BudgetPeriod = "daily" | "weekly" | "monthly" | "global";

const periods: { value: BudgetPeriod; label: string }[] = [
    { value: "daily", label: "Daily" },
    { value: "weekly", label: "Weekly" },
    { value: "monthly", label: "Monthly" },
    { value: "global", label: "Global" },
];

export function FormBudgetRow({ disabled }: { disabled?: boolean }) {
    const form = useFormContext<CampaignDraft>();
    const { control, setValue, watch } = form;
    const budgetConfig = watch("budgetConfig");
    const budget = budgetConfig?.[0];

    const preferredCurrency = currencyStore((state) => state.preferredCurrency);
    const rewardToken = watch("rewardToken");
    const currencyLabel = (
        tokenAddressToCurrency(rewardToken) ?? preferredCurrency
    ).toUpperCase();

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

        const newBudgetConfig: CampaignDraft["budgetConfig"] = [
            { label, durationInSeconds: duration, amount: newAmount },
        ];
        setValue("budgetConfig", newBudgetConfig, {
            shouldValidate: true,
            shouldDirty: true,
        });
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
                    render={({ field }) => (
                        <FormItem>
                            <FormDescription label="Budget Amount" />
                            <FormMessage />
                            <FormControl>
                                <InputAmount
                                    placeholder="25,00 €"
                                    length="medium"
                                    disabled={disabled}
                                    rightSection={currencyLabel}
                                    value={currentAmount}
                                    onChange={
                                        ((val: number | string) => {
                                            const num =
                                                typeof val === "number"
                                                    ? val
                                                    : 0;
                                            updateBudget(period, num);
                                        }) as InputNumberProps["onChange"]
                                    }
                                    name="budgetAmount"
                                    onBlur={field.onBlur}
                                    ref={field.ref}
                                />
                            </FormControl>
                        </FormItem>
                    )}
                />
            </Row>

            <div>
                <div className={styles.budgetSection}>
                    <div className={styles.budgetIconGroup}>
                        <div className={styles.budgetIcon}>
                            <CircleDollarSign />
                        </div>
                        <span className={styles.budgetLabel}>
                            Frak commission (20%)
                        </span>
                    </div>
                    <div className={styles.budgetValue}>
                        {frakCommission.toFixed(2)} {currencyLabel}
                    </div>
                </div>

                <div className={styles.budgetDivider} />

                <div className={styles.budgetSection}>
                    <div className={styles.budgetIconGroup}>
                        <div className={styles.budgetIcon}>
                            <Wallet />
                        </div>
                        <span className={styles.budgetLabel}>
                            Rewards distributed (80%)
                        </span>
                    </div>
                    <div className={styles.budgetValue}>
                        {remainingBudget.toFixed(2)} {currencyLabel}
                    </div>
                </div>
            </div>
        </Column>
    );
}
