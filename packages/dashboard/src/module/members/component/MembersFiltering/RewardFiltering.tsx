import { Row } from "@/module/common/component/Row";
import {
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/module/forms/Form";
import type { FormMembersFiltering } from "@/module/members/component/MembersFiltering/index";
import { Checkbox } from "@module/component/forms/Checkbox";
import { Input } from "@module/component/forms/Input";
import { useFormContext, useWatch } from "react-hook-form";
import styles from "./index.module.css";

export function RewardFiltering({
    onSubmit,
}: { onSubmit: (data: FormMembersFiltering) => void }) {
    const { control, formState, handleSubmit } =
        useFormContext<FormMembersFiltering>();
    const currentRewards = useWatch({ control, name: "rewards" });
    const rewardsInputDisabled = currentRewards === undefined;
    const isAllUndefined =
        currentRewards?.min === undefined && currentRewards?.max === undefined;

    /**
     * If form is disabled and all values are undefined, return null to hide the component
     */
    if (formState.disabled && isAllUndefined) return null;

    return (
        <div>
            <FormField
                control={control}
                name={"rewards"}
                render={({ field }) => (
                    <FormItem variant={"checkbox"}>
                        <Checkbox
                            checked={!rewardsInputDisabled}
                            disabled={formState.disabled}
                            id={"reward-filters"}
                            onCheckedChange={(checked) => {
                                field.onChange(
                                    checked
                                        ? { min: 1, max: undefined }
                                        : undefined
                                );
                                !checked && handleSubmit(onSubmit)();
                            }}
                        />
                        <FormLabel
                            weight={"medium"}
                            variant={"checkbox"}
                            selected={!!field.value}
                            htmlFor={"reward-filters"}
                        >
                            Rewards
                        </FormLabel>
                    </FormItem>
                )}
            />
            <Row className={styles.formFromTo__row}>
                <FormField
                    control={control}
                    name={"rewards.min"}
                    disabled={rewardsInputDisabled || formState.disabled}
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
                            <Input
                                type={"number"}
                                {...field}
                                value={
                                    rewardsInputDisabled
                                        ? ""
                                        : field.value ?? ""
                                }
                                placeholder={"Min reward"}
                                length={"small"}
                                rightSection={"EUR"}
                                onBlur={handleSubmit(onSubmit)}
                            />
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={control}
                    name={"rewards.max"}
                    disabled={rewardsInputDisabled || formState.disabled}
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
                            <Input
                                type={"number"}
                                {...field}
                                value={
                                    rewardsInputDisabled
                                        ? ""
                                        : field.value ?? ""
                                }
                                placeholder={"Max reward"}
                                length={"small"}
                                rightSection={"EUR"}
                                onBlur={handleSubmit(onSubmit)}
                            />
                            <FormMessage />
                        </FormItem>
                    )}
                />
            </Row>
        </div>
    );
}
