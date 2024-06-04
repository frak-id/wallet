"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import type { ComponentProps } from "react";
import { DayPicker } from "react-day-picker";
import { default as defaultStyles } from "react-day-picker/dist/style.module.css";

export type CalendarProps = ComponentProps<typeof DayPicker>;

export function Calendar({
    className,
    classNames,
    showOutsideDays = true,
    ...props
}: CalendarProps) {
    return (
        <DayPicker
            showOutsideDays={showOutsideDays}
            classNames={defaultStyles}
            components={{
                IconLeft: () => <ChevronLeft size={20} />,
                IconRight: () => <ChevronRight size={20} />,
            }}
            {...props}
        />
    );
}
Calendar.displayName = "Calendar";
