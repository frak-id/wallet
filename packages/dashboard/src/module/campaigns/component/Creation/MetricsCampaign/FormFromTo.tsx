import { Row } from "@/module/common/component/Row";
import {
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/module/forms/Form";
import { Checkbox } from "@module/component/forms/Checkbox";
import { InputNumber } from "@module/component/forms/InputNumber";
import { useEffect, useState } from "react";
import type {
    FieldPath,
    FieldValues,
    PathValue,
    RegisterOptions,
    UseFormReturn,
} from "react-hook-form";
import styles from "./FormFromTo.module.css";

type FormFromToProps<
    TFieldValues extends FieldValues = FieldValues,
    TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
> = {
    id: string;
    label: string;
    from: {
        name: TName;
        label: string;
        placeholder: string;
        rightSection: string;
        rules?: Omit<
            RegisterOptions<TFieldValues, TName>,
            "valueAsNumber" | "valueAsDate" | "setValueAs" | "disabled"
        >;
    };
    to: {
        name: TName;
        label: string;
        placeholder: string;
        rightSection: string;
        rules?: Omit<
            RegisterOptions<TFieldValues, TName>,
            "valueAsNumber" | "valueAsDate" | "setValueAs" | "disabled"
        >;
    };
    form: UseFormReturn<TFieldValues>;
    hideIfAllZero?: boolean;
    disabled?: boolean;
    defaultChecked?: boolean;
};

export function FormFromTo<
    TFieldValues extends FieldValues = FieldValues,
    TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
>({
    id,
    label,
    from,
    to,
    form,
    hideIfAllZero,
    disabled,
    defaultChecked = false,
}: FormFromToProps<TFieldValues, TName>) {
    type FieldValue = PathValue<TFieldValues, TName>;

    const values = form.getValues([from.name, to.name]);
    const isAllZero = values.every((value) => value === 0);

    const [checked, setIsChecked] = useState<boolean | "indeterminate">(
        defaultChecked
    );

    useEffect(() => {
        if (defaultChecked) return;
        setIsChecked(!isAllZero ?? "indeterminate");
    }, [isAllZero, defaultChecked]);

    function checkingCheckbox(value: boolean | "indeterminate") {
        setIsChecked(value);
        if (value === false) {
            form.setValue<TName>(from.name, 0 as FieldValue);
            form.setValue<TName>(to.name, 0 as FieldValue);
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
                    control={form.control}
                    name={from.name}
                    rules={from.rules}
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel variant={"light"}>
                                {from.label}
                            </FormLabel>
                            <FormMessage />
                            <FormControl>
                                <InputNumber
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
                    control={form.control}
                    name={to.name}
                    rules={to.rules}
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel variant={"light"}>{to.label}</FormLabel>
                            <FormMessage />
                            <FormControl>
                                <InputNumber
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
