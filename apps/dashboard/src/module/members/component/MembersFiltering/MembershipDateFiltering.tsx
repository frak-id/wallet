import { ButtonCalendar } from "@/module/common/component/ButtonCalendar";
import { Calendar } from "@/module/common/component/Calendar";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/module/common/component/Popover";
import { Row } from "@/module/common/component/Row";
import {
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/module/forms/Form";
import type { FormMembersFiltering } from "@/module/members/component/MembersFiltering";
import { Checkbox } from "@frak-labs/ui/component/forms/Checkbox";
import { format, startOfDay } from "date-fns";
import { memo, useEffect, useState } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import styles from "./index.module.css";

export const MembershipDateFiltering = memo(function MembershipDateFiltering({
    disabled,
    onSubmit,
}: { disabled?: boolean; onSubmit: (data: FormMembersFiltering) => void }) {
    const { control, handleSubmit, setValue } =
        useFormContext<FormMembersFiltering>();
    const currentFirstInteractionTimestamp = useWatch({
        control,
        name: "firstInteractionTimestamp",
    });
    const inputDisabled = currentFirstInteractionTimestamp === undefined;
    const isAllUndefined =
        currentFirstInteractionTimestamp?.min === undefined &&
        currentFirstInteractionTimestamp?.max === undefined;
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
            <FormDescription label={"Segment"} />
            <FormItem variant={"checkbox"}>
                <Checkbox
                    checked={checked === true}
                    disabled={disabled}
                    id={"date-filters"}
                    onCheckedChange={(checked) => {
                        setValue(
                            "firstInteractionTimestamp",
                            checked
                                ? {
                                      min: new Date().getTime() / 1000,
                                      max: undefined,
                                  }
                                : undefined
                        );
                        setIsChecked(checked);
                        handleSubmit(onSubmit)();
                    }}
                />
                <FormLabel
                    weight={"medium"}
                    variant={"checkbox"}
                    selected={checked === true}
                    htmlFor={"date-filters"}
                >
                    Membership Date
                </FormLabel>
            </FormItem>
            <Row className={styles.formFromTo__row}>
                <FormField
                    control={control}
                    name={"firstInteractionTimestamp.min"}
                    render={({ field }) => {
                        const { value, ...rest } = field;
                        return (
                            <FormItem>
                                <FormLabel variant={"light"} weight={"medium"}>
                                    From
                                </FormLabel>
                                <Popover>
                                    <PopoverTrigger {...rest} asChild>
                                        <FormControl>
                                            <ButtonCalendar
                                                disabled={
                                                    checked === false ||
                                                    disabled
                                                }
                                            >
                                                {field.value ? (
                                                    format(
                                                        field.value * 1000,
                                                        "PPP"
                                                    )
                                                ) : (
                                                    <span>Pick a date</span>
                                                )}
                                            </ButtonCalendar>
                                        </FormControl>
                                    </PopoverTrigger>
                                    <PopoverContent align="start">
                                        <Calendar
                                            mode="single"
                                            selected={
                                                field.value
                                                    ? new Date(
                                                          field.value * 1000
                                                      )
                                                    : undefined
                                            }
                                            onSelect={(value) => {
                                                if (!value) return;
                                                field.onChange(
                                                    (value.getTime() ?? 0) /
                                                        1000
                                                );
                                                handleSubmit(onSubmit)();
                                            }}
                                            startMonth={startOfDay(new Date())}
                                        />
                                    </PopoverContent>
                                </Popover>
                                <FormMessage />
                            </FormItem>
                        );
                    }}
                />
                <FormField
                    control={control}
                    name={"firstInteractionTimestamp.max"}
                    render={({ field }) => {
                        const { value, ...rest } = field;
                        return (
                            <FormItem>
                                <FormLabel variant={"light"} weight={"medium"}>
                                    To
                                </FormLabel>
                                <Popover>
                                    <PopoverTrigger {...rest} asChild>
                                        <FormControl>
                                            <ButtonCalendar
                                                disabled={
                                                    checked === false ||
                                                    disabled
                                                }
                                            >
                                                {field.value ? (
                                                    format(
                                                        field.value * 1000,
                                                        "PPP"
                                                    )
                                                ) : (
                                                    <span>Pick a date</span>
                                                )}
                                            </ButtonCalendar>
                                        </FormControl>
                                    </PopoverTrigger>
                                    <PopoverContent align="start">
                                        <Calendar
                                            mode="single"
                                            selected={
                                                field.value
                                                    ? new Date(
                                                          field.value * 1000
                                                      )
                                                    : undefined
                                            }
                                            onSelect={(value) => {
                                                if (!value) return;
                                                field.onChange(
                                                    (value.getTime() ?? 0) /
                                                        1000
                                                );
                                                handleSubmit(onSubmit)();
                                            }}
                                            startMonth={startOfDay(new Date())}
                                        />
                                    </PopoverContent>
                                </Popover>
                                <FormMessage />
                            </FormItem>
                        );
                    }}
                />
            </Row>
        </>
    );
});
