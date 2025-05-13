import { Row } from "@/module/common/component/Row";
import {
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/module/forms/Form";
import { Checkbox } from "@shared/module/component/forms/Checkbox";
import { InputNumber } from "@shared/module/component/forms/InputNumber";
import { useEffect, useState } from "react";
import { type FieldPath, useFormContext } from "react-hook-form";
import type { Campaign } from "../../../../../types/Campaign";
import styles from "./FormFromTo.module.css";

type FormNumberProps = {
    id: string;
    label: string;
    field: {
        label: string;
        placeholder: string;
        rightSection: string;
        keys: FieldPath<Campaign>[];
    };
    hideIfAllZero?: boolean;
    disabled?: boolean;
    defaultChecked?: boolean;
};

export function FormNumber({
    id,
    label,
    field: rawField,
    hideIfAllZero,
    disabled,
    defaultChecked = false,
}: FormNumberProps) {
    const { getValues, setValue, control } = useFormContext();

    const values = getValues(rawField.keys);
    const isAllZero = values.every(
        (value) => value === 0 || value === undefined
    );

    const [checked, setIsChecked] = useState<boolean | "indeterminate">(
        defaultChecked
    );

    useEffect(() => {
        if (defaultChecked) return;
        setIsChecked(!isAllZero);
    }, [isAllZero, defaultChecked]);

    function checkingCheckbox(value: boolean | "indeterminate") {
        setIsChecked(value);
        if (value === false) {
            for (const key of rawField.keys) {
                setValue(key, 0);
            }
        }
    }

    if (hideIfAllZero && isAllZero) return null;

    return (
        <>
            <FormItem variant={"checkbox"}>
                <Checkbox
                    onCheckedChange={checkingCheckbox}
                    checked={checked === true}
                    id={id}
                    disabled={disabled}
                />
                <FormLabel
                    variant={"checkbox"}
                    selected={checked === true}
                    htmlFor={id}
                    aria-disabled={disabled}
                >
                    {label}
                </FormLabel>
            </FormItem>
            <Row className={styles.formFromTo__row}>
                <FormField
                    control={control}
                    name={rawField.keys[0]}
                    rules={{
                        validate: (value) => {
                            if (checked) return value > 0;
                            return true;
                        },
                    }}
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel variant={"light"}>
                                {rawField.label}
                            </FormLabel>
                            <FormMessage />
                            <FormControl>
                                <InputNumber
                                    length={"small"}
                                    placeholder={rawField.placeholder}
                                    rightSection={rawField.rightSection}
                                    disabled={disabled ?? checked !== true}
                                    {...field}
                                />
                            </FormControl>
                        </FormItem>
                    )}
                />
            </Row>
        </>
    );
}
