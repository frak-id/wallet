import { Row } from "@/module/common/component/Row";
import {
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/module/forms/Form";
import { interactionTypesInfo } from "@/module/product/utils/interactionTypes";
import type { InteractionTypesKey } from "@frak-labs/core-sdk";
import { Checkbox } from "@frak-labs/shared/module/component/forms/Checkbox";
import { InputNumber } from "@frak-labs/shared/module/component/forms/InputNumber";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useFormContext } from "react-hook-form";
import styles from "./FormTrigger.module.css";

type FormTriggerProps = {
    interaction: InteractionTypesKey;
    hideIfAllZero?: true;
    disabled?: boolean;
    defaultChecked?: boolean;
};

export function FormTrigger({
    interaction,
    hideIfAllZero,
    disabled,
    defaultChecked = false,
}: FormTriggerProps) {
    const { watch, setValue } = useFormContext();
    const triggers = watch("triggers");

    const [checked, setIsChecked] = useState<boolean | "indeterminate">(
        defaultChecked
    );

    const trigger = useMemo(
        () => triggers[interaction],
        [triggers, interaction]
    );
    const label = useMemo(
        () => interactionTypesInfo[interaction].name,
        [interaction]
    );

    // Check if the trigger is all zeroes
    const isAllZeroes = useMemo(() => {
        if ("from" in trigger) {
            return trigger.from === 0 && trigger.to === 0;
        }
        return trigger.cac === 0;
    }, [trigger]);

    // Auto check by default if value is present
    useEffect(() => {
        if (defaultChecked) return;
        setIsChecked(!isAllZeroes);
    }, [isAllZeroes, defaultChecked]);

    // Validation on each input CAC
    const validateCacInput = useCallback(
        (value: number) => {
            if (!checked) return true;

            if (value <= 1) return "The CAC should be greater than 1";
            if (Number.isNaN(value)) return "The CAC should be a number";
            if (value > 1000) return "The CAC should be less than 1k";
            return true;
        },
        [checked]
    );

    const checkingCheckbox = useCallback(
        (value: boolean | "indeterminate") => {
            setIsChecked(value);
            // Early exit if nothing more to do
            if (value !== false) return;

            // If we are on legacy forms, we need to set the values to 0
            if ("from" in trigger) {
                setValue(`triggers.${interaction}.from`, 0);
                setValue(`triggers.${interaction}.to`, 0);
            } else {
                // If we are on new forms, we need to set the value to 0
                setValue(`triggers.${interaction}.cac`, 0);
            }
        },
        [setValue, trigger, interaction]
    );

    if (hideIfAllZero && isAllZeroes) return null;

    return (
        <>
            <FormItem variant={"checkbox"}>
                <Checkbox
                    onCheckedChange={checkingCheckbox}
                    checked={checked === true}
                    id={interaction}
                    disabled={disabled}
                />
                <FormLabel
                    variant={"checkbox"}
                    selected={checked === true}
                    htmlFor={interaction}
                    aria-disabled={disabled}
                >
                    {label}
                </FormLabel>
            </FormItem>
            <InputRouter
                trigger={trigger}
                interaction={interaction}
                validateCacInput={validateCacInput}
                disabled={disabled ?? false}
                checked={checked === true}
            />
        </>
    );
}

function InputRouter({
    trigger,
    interaction,
    validateCacInput,
    disabled,
    checked,
}: {
    interaction: InteractionTypesKey;
    validateCacInput: (value: number) => string | true;
    disabled: boolean;
    checked: boolean;
    trigger: { cac: number } | { from: number; to: number };
}) {
    if ("from" in trigger) {
        return (
            <LegacyRangeInputInputs
                interaction={interaction}
                validateCacInput={validateCacInput}
                disabled={disabled}
                checked={checked}
            />
        );
    }
    return (
        <FixedInput
            interaction={interaction}
            validateCacInput={validateCacInput}
            disabled={disabled}
            checked={checked}
        />
    );
}

function FixedInput({
    interaction,
    validateCacInput,
    disabled,
    checked,
}: {
    interaction: InteractionTypesKey;
    validateCacInput: (value: number) => string | true;
    disabled: boolean;
    checked: boolean;
}) {
    const { control } = useFormContext();
    return (
        <Row className={styles.formTrigger__row}>
            <FormField
                control={control}
                name={`triggers.${interaction}.cac`}
                rules={{
                    validate: validateCacInput,
                }}
                render={({ field }) => (
                    <FormItem>
                        <FormLabel variant={"light"}>CPA</FormLabel>
                        <FormMessage />
                        <FormControl>
                            <InputNumber
                                key={`${interaction}-single`}
                                length={"small"}
                                placeholder={"25,00 €"}
                                rightSection={"EUR"}
                                disabled={disabled ?? checked !== true}
                                {...field}
                            />
                        </FormControl>
                    </FormItem>
                )}
            />
        </Row>
    );
}

/**
 * This is the input for legacy forms (with a range of from <> to)
 */
function LegacyRangeInputInputs({
    interaction,
    validateCacInput,
    disabled,
    checked,
}: {
    interaction: InteractionTypesKey;
    validateCacInput: (value: number) => string | true;
    disabled: boolean;
    checked: boolean;
}) {
    const { control } = useFormContext();
    return (
        <Row className={styles.formTrigger__row}>
            <FormField
                control={control}
                name={`triggers.${interaction}.from`}
                rules={{
                    validate: validateCacInput,
                }}
                render={({ field }) => (
                    <FormItem>
                        <FormLabel variant={"light"}>From</FormLabel>
                        <FormMessage />
                        <FormControl>
                            <InputNumber
                                key={`${interaction}-from`}
                                length={"small"}
                                placeholder={"15,00 €"}
                                rightSection={"EUR"}
                                disabled={disabled ?? checked !== true}
                                {...field}
                            />
                        </FormControl>
                    </FormItem>
                )}
            />
            <FormField
                control={control}
                name={`triggers.${interaction}.to`}
                rules={{
                    validate: validateCacInput,
                }}
                render={({ field }) => (
                    <FormItem>
                        <FormLabel variant={"light"}>To</FormLabel>
                        <FormMessage />
                        <FormControl>
                            <InputNumber
                                key={`${interaction}-to`}
                                length={"small"}
                                placeholder={"25,00 €"}
                                rightSection={"EUR"}
                                disabled={disabled ?? checked !== true}
                                {...field}
                            />
                        </FormControl>
                    </FormItem>
                )}
            />
        </Row>
    );
}
