import { Row } from "@/module/common/component/Row";
import { Checkbox } from "@/module/forms/Checkbox";
import {
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/module/forms/Form";
import { Input } from "@/module/forms/Input";
import { useState } from "react";
import type {
    FieldValues,
    Path,
    RegisterOptions,
    UseFormReturn,
} from "react-hook-form";
import styles from "./FormFromTo.module.css";

export function FormFromTo<TFormValues extends FieldValues>({
    id,
    label,
    from,
    to,
    form,
    defaultChecked,
}: {
    id: string;
    label: string;
    from: {
        name: Path<TFormValues>;
        label: string;
        placeholder: string;
        rightSection: string;
        rules?: RegisterOptions;
    };
    to: {
        name: Path<TFormValues>;
        label: string;
        placeholder: string;
        rightSection: string;
        rules?: RegisterOptions;
    };
    form: UseFormReturn<TFormValues>;
    defaultChecked?: boolean;
}) {
    const [checked, setIsChecked] = useState<boolean | "indeterminate">(
        defaultChecked ?? "indeterminate"
    );

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
                                <Input
                                    type={"number"}
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
                                <Input
                                    type={"number"}
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
