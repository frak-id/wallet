import { button } from "@frak-labs/design-system/components/Button";
import clsx from "clsx";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { ComponentProps } from "react";
import { DayPicker } from "react-day-picker";
import * as styles from "./calendar.css";

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
            className={clsx(styles.root, className)}
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
                day_button: `${button({ variant: "ghost" })} ${styles.day}`,
                range_end: "day-range-end",
                selected: styles.daySelected,
                today: styles.dayToday,
                outside: `day-outside ${styles.dayOutside}`,
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
