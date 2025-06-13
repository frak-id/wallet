import { Row } from "@/module/common/component/Row";
import {
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/module/forms/Form";
import type { FormMembersFiltering } from "@/module/members/component/MembersFiltering";
import { Checkbox } from "@frak-labs/ui/component/forms/Checkbox";
import { Input } from "@frak-labs/ui/component/forms/Input";
import { useEffect, useState } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import styles from "./index.module.css";

export function InteractionsFiltering({
    disabled,
    onSubmit,
}: { disabled?: boolean; onSubmit: (data: FormMembersFiltering) => void }) {
    const { control, handleSubmit, setValue } =
        useFormContext<FormMembersFiltering>();
    const currentInteractions = useWatch({ control, name: "interactions" });
    const inputDisabled = currentInteractions === undefined;
    const isAllUndefined =
        currentInteractions?.min === undefined &&
        currentInteractions?.max === undefined;
    const [checked, setIsChecked] = useState<boolean | "indeterminate">(
        "indeterminate"
    );

    useEffect(() => {
        setIsChecked(!inputDisabled);
    }, [inputDisabled]);

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
                    id={"interaction-filters"}
                    onCheckedChange={(checked) => {
                        setValue(
                            "interactions",
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
                    htmlFor={"interaction-filters"}
                >
                    Interactions
                </FormLabel>
            </FormItem>
            <Row className={styles.formFromTo__row}>
                <FormField
                    control={control}
                    name={"interactions.min"}
                    disabled={inputDisabled || disabled}
                    rules={{
                        required: false,
                        min: {
                            value: 0,
                            message:
                                "Minimum interactions count must be greater than 0",
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
                                value={inputDisabled ? "" : (field.value ?? "")}
                                placeholder={"Min interactions"}
                                length={"small"}
                                onBlur={handleSubmit(onSubmit)}
                            />
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={control}
                    name={"interactions.max"}
                    disabled={inputDisabled || disabled}
                    rules={{
                        required: false,
                        min: {
                            value: 0,
                            message:
                                "Maximum interactions count must be greater than 0",
                        },
                        validate: (value) => {
                            if (
                                !value ||
                                Number.isNaN(value) ||
                                Number.isNaN(currentInteractions?.min)
                            )
                                return;

                            if (
                                Number.parseInt(
                                    currentInteractions?.min as unknown as string
                                ) >= Number.parseInt(value as unknown as string)
                            ) {
                                return "Max interactions should be greater than minimum";
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
                                value={inputDisabled ? "" : (field.value ?? "")}
                                placeholder={"Max interactions"}
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
