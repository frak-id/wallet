"use client";

import { Row } from "@/module/common/component/Row";
import {
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/module/forms/Form";
import type { Campaign } from "@/types/Campaign";
import { Checkbox } from "@shared/module/component/forms/Checkbox";
import { InputNumber } from "@shared/module/component/forms/InputNumber";
import { useEffect, useState } from "react";
import { type FieldPath, useFormContext } from "react-hook-form";
import styles from "./FormFromTo.module.css";

type FormFromToProps = {
    id: string;
    label: string;
    from: {
        name: FieldPath<Campaign>;
        label: string;
        placeholder: string;
        rightSection: string;
    };
    to: {
        name: FieldPath<Campaign>;
        label: string;
        placeholder: string;
        rightSection: string;
    };
    hideIfAllZero?: boolean;
    disabled?: boolean;
    defaultChecked?: boolean;
};

export function FormFromTo({
    id,
    label,
    from,
    to,
    hideIfAllZero,
    disabled,
    defaultChecked = false,
}: FormFromToProps) {
    const { getValues, setValue, control } = useFormContext();

    const values = getValues([from.name, to.name]);
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
            setValue(from.name, 0);
            setValue(to.name, 0);
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
                    name={from.name}
                    rules={{
                        validate: (value) => {
                            if (checked) return value > 0;
                            return true;
                        },
                    }}
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel variant={"light"}>
                                {from.label}
                            </FormLabel>
                            <FormMessage />
                            <FormControl>
                                <InputNumber
                                    key={`${id}-${from.name}`}
                                    length={"small"}
                                    placeholder={from.placeholder}
                                    rightSection={from.rightSection}
                                    disabled={disabled ?? checked !== true}
                                    {...field}
                                />
                            </FormControl>
                        </FormItem>
                    )}
                />
                <FormField
                    control={control}
                    name={to.name}
                    rules={{
                        validate: (value) => {
                            if (checked) return value > 0;
                            return true;
                        },
                    }}
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel variant={"light"}>{to.label}</FormLabel>
                            <FormMessage />
                            <FormControl>
                                <InputNumber
                                    key={`${id}-${to.name}`}
                                    length={"small"}
                                    placeholder={to.placeholder}
                                    rightSection={to.rightSection}
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
