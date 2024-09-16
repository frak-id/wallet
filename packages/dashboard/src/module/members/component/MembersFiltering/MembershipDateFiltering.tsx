import { ButtonCalendar } from "@/module/common/component/ButtonCalendar";
import { Calendar } from "@/module/common/component/Calendar";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/module/common/component/Popover";
import {
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/module/forms/Form";
import type { FormMembersFiltering } from "@/module/members/component/MembersFiltering/index";
import { Columns } from "@module/component/Columns";
import { Checkbox } from "@module/component/forms/Checkbox";
import { format, startOfDay } from "date-fns";
import { useFormContext, useWatch } from "react-hook-form";

export function MembershipDateFiltering() {
    const { control, formState } = useFormContext<FormMembersFiltering>();
    const currentInteractions = useWatch({
        control,
        name: "firstInteractionTimestamp",
    });
    const inputDisabled = currentInteractions === undefined;

    return (
        <div>
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
            <Columns>
                <FormField
                    control={control}
                    name={"firstInteractionTimestamp.min"}
                    disabled={inputDisabled || formState.disabled}
                    render={({ field }) => {
                        const { value, ...rest } = field;
                        return (
                            <FormItem>
                                <FormLabel weight={"medium"}>From</FormLabel>
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
                                <FormLabel weight={"medium"}>To</FormLabel>
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
                                                // const huhu =
                                                //     (value.getTime() ?? 0) /
                                                //     1000;
                                                // console.log("huhu", huhu);
                                                field.onChange(
                                                    (value.getTime() ?? 0) /
                                                        1000
                                                );
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
            </Columns>
        </div>
    );
}
