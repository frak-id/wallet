import { InputAmount } from "@/module/common/component/InputAmount";
import { Row } from "@/module/common/component/Row";
import {
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/module/forms/Form";
import type { FormMembersFiltering } from "@/module/members/component/MembersFiltering";
import { Checkbox } from "@frak-labs/ui/component/forms/Checkbox";
import { useEffect, useState } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import styles from "./index.module.css";

export function RewardFiltering({
    disabled,
    onSubmit,
}: { disabled?: boolean; onSubmit: (data: FormMembersFiltering) => void }) {
    const { control, handleSubmit, setValue } =
        useFormContext<FormMembersFiltering>();
    const currentRewards = useWatch({ control, name: "rewards" });
    const rewardsInputDisabled = currentRewards === undefined;
    const isAllUndefined =
        currentRewards?.min === undefined && currentRewards?.max === undefined;
    const [checked, setIsChecked] = useState<boolean | "indeterminate">(
        "indeterminate"
    );

    useEffect(() => {
        setIsChecked(!rewardsInputDisabled);
    }, [rewardsInputDisabled]);

    /**
     * If form is disabled and all values are undefined, return null to hide the component
     */
    if (disabled && isAllUndefined) return null;

    return (
        <>
            <FormItem variant={"checkbox"}>
                <Checkbox
                    checked={checked === true}
                    disabled={disabled}
                    id={"reward-filters"}
                    onCheckedChange={(checked) => {
                        setValue(
                            "rewards",
                            checked
                                ? { min: undefined, max: undefined }
                                : undefined
                        );
                        !checked && handleSubmit(onSubmit)();
                    }}
                />
                <FormLabel
                    weight={"medium"}
                    variant={"checkbox"}
                    selected={checked === true}
                    htmlFor={"reward-filters"}
                >
                    Rewards
                </FormLabel>
            </FormItem>
            <Row className={styles.formFromTo__row}>
                <FormField
                    control={control}
                    name={"rewards.min"}
                    disabled={rewardsInputDisabled || disabled}
                    rules={{
                        required: false,
                        min: {
                            value: 0,
                            message: "Minimum rewards must be greater than 0",
                        },
                    }}
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel variant={"light"} weight={"medium"}>
                                From
                            </FormLabel>
                            <InputAmount
                                {...field}
                                value={
                                    rewardsInputDisabled
                                        ? ""
                                        : (field.value ?? "")
                                }
                                placeholder={"Min reward"}
                                length={"small"}
                                onBlur={handleSubmit(onSubmit)}
                            />
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={control}
                    name={"rewards.max"}
                    disabled={rewardsInputDisabled || disabled}
                    rules={{
                        required: false,
                        min: {
                            value: 0,
                            message: "Maximum rewards must be greater than 0",
                        },
                        validate: (value) => {
                            if (
                                !value ||
                                Number.isNaN(value) ||
                                Number.isNaN(currentRewards?.min)
                            )
                                return;
                            if (
                                Number.parseFloat(
                                    currentRewards?.min as unknown as string
                                ) >=
                                Number.parseFloat(value as unknown as string)
                            ) {
                                return "Max reward should be greater than min reward";
                            }
                        },
                    }}
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel variant={"light"} weight={"medium"}>
                                To
                            </FormLabel>
                            <InputAmount
                                {...field}
                                value={
                                    rewardsInputDisabled
                                        ? ""
                                        : (field.value ?? "")
                                }
                                placeholder={"Max reward"}
                                length={"small"}
                                onBlur={handleSubmit(onSubmit)}
                            />
                            <FormMessage />
                        </FormItem>
                    )}
                />
            </Row>
        </>
    );
}
