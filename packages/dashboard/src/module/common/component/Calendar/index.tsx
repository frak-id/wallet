"use client";

import { buttonVariants } from "@shared/module/component/Button";
import { cx } from "class-variance-authority";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { ComponentProps } from "react";
import { DayPicker } from "react-day-picker";
import styles from "./index.module.css";

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
            className={cx(styles.root, className)}
            classNames={{
                months: styles.months,
                month_caption: styles.caption,
                nav: styles.nav,
                button_previous: styles.navButtonPrevious,
                button_next: styles.navButtonNext,
                month_grid: styles.table,
                weekdays: styles.headRow,
                weekday: styles.headCell,
                weeks: styles.tbody,
                week: styles.row,
                day: styles.cell,
                day_button: cx(
                    buttonVariants({ variant: "ghost" }),
                    styles.day
                ),
                range_end: "day-range-end",
                selected: styles.daySelected,
                today: styles.dayToday,
                outside: cx("day-outside", styles.dayOutside),
                disabled: styles.dayDisabled,
                hidden: "invisible",
                ...classNames,
            }}
            components={{
                Chevron: (props) => {
                    if (props.orientation === "left") {
                        return <ChevronLeft size={18} />;
                    }
                    return <ChevronRight size={18} />;
                },
            }}
            {...props}
        />
    );
}
Calendar.displayName = "Calendar";
