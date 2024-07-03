"use client";

import { buttonVariants } from "@module/component/Button";
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
                caption: styles.caption,
                nav: styles.nav,
                nav_button: cx(styles.navButton),
                nav_button_previous: styles.navButtonPrevious,
                nav_button_next: styles.navButtonNext,
                table: styles.table,
                head_row: styles.headRow,
                head_cell: styles.headCell,
                tbody: styles.tbody,
                row: styles.row,
                cell: styles.cell,
                day: cx(buttonVariants({ variant: "ghost" }), styles.day),
                day_range_end: "day-range-end",
                day_selected: styles.daySelected,
                day_today: styles.dayToday,
                day_outside: cx("day-outside", styles.dayOutside),
                day_disabled: styles.dayDisabled,
                day_hidden: "invisible",
                ...classNames,
            }}
            components={{
                IconLeft: () => <ChevronLeft size={18} />,
                IconRight: () => <ChevronRight size={18} />,
            }}
            {...props}
        />
    );
}
Calendar.displayName = "Calendar";
