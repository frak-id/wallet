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
import type { FormMembersFiltering } from "@/module/members/component/MembersFiltering/index";
import { Checkbox } from "@module/component/forms/Checkbox";
import { format, startOfDay } from "date-fns";
import { useFormContext, useWatch } from "react-hook-form";
import styles from "./index.module.css";

export function MembershipDateFiltering({
    onSubmit,
}: { onSubmit: (data: FormMembersFiltering) => void }) {
    const { control, formState, handleSubmit } =
        useFormContext<FormMembersFiltering>();
    const currentFirstInteractionTimestamp = useWatch({
        control,
        name: "firstInteractionTimestamp",
    });
    const inputDisabled = currentFirstInteractionTimestamp === undefined;
    const isAllUndefined =
        currentFirstInteractionTimestamp?.min === undefined &&
        currentFirstInteractionTimestamp?.max === undefined;

    /**
     * If form is disabled and all values are undefined, return null to hide the component
     */
    if (formState.disabled && isAllUndefined) return null;

    return (
        <div>
            <FormDescription title={"Segment"} />
            <FormField
                control={control}
                name={"firstInteractionTimestamp"}
                render={({ field }) => (
                    <FormItem variant={"checkbox"}>
                        <Checkbox
                            checked={!inputDisabled}
                            id={"date-filters"}
                            disabled={formState.disabled}
                            onCheckedChange={(checked) => {
                                field.onChange(
                                    checked
                                        ? {
                                              min: startOfDay(new Date()),
                                              max: undefined,
                                          }
                                        : undefined
                                );
                                !checked && handleSubmit(onSubmit)();
                            }}
                        />
                        <FormLabel
                            weight={"medium"}
                            variant={"checkbox"}
                            selected={!!field.value}
                            htmlFor={"date-filters"}
                        >
                            Membership Date
                        </FormLabel>
                    </FormItem>
                )}
            />
            <Row className={styles.formFromTo__row}>
                <FormField
                    control={control}
                    name={"firstInteractionTimestamp.min"}
                    disabled={inputDisabled || formState.disabled}
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
                                            <ButtonCalendar>
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
                    disabled={inputDisabled || formState.disabled}
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
                                            <ButtonCalendar>
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
        </div>
    );
}
