import { Row } from "@/module/common/component/Row";
import { Checkbox } from "@/module/forms/Checkbox";
import {
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/module/forms/Form";
import { InputNumber } from "@/module/forms/InputNumber";
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
        rules?: RegisterOptions;
    };
    to: {
        name: TName;
        label: string;
        placeholder: string;
        rightSection: string;
        rules?: RegisterOptions;
    };
    form: UseFormReturn<TFieldValues>;
    hideIfAllZero?: boolean;
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
}: FormFromToProps<TFieldValues, TName>) {
    type FieldValue = PathValue<TFieldValues, TName>;

    const values = form.getValues([from.name, to.name]);
    const isAllZero = values.every((value) => value === 0);

    const [checked, setIsChecked] = useState<boolean | "indeterminate">(
        !isAllZero ?? "indeterminate"
    );

    useEffect(() => {
        if (!checked) {
            form.setValue<TName>(from.name, 0 as FieldValue);
            form.setValue<TName>(to.name, 0 as FieldValue);
        }
    }, [checked, form, from.name, to.name]);

    if (hideIfAllZero && isAllZero) return null;

    return (
        <>
            <FormItem variant={"checkbox"}>
                <Checkbox
                    onCheckedChange={setIsChecked}
                    checked={checked === true}
                    id={id}
                />
                <FormLabel
                    variant={"checkbox"}
                    selected={checked === true}
                    htmlFor={id}
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
                                    placeholder={from.placeholder}
                                    rightSection={from.rightSection}
                                    disabled={checked !== true}
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
                                    placeholder={to.placeholder}
                                    rightSection={to.rightSection}
                                    disabled={checked !== true}
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
