import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@frak-labs/design-system/components/Popover";
import { CalendarIcon } from "@frak-labs/design-system/icons";
import { format, isAfter, isBefore } from "date-fns";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Calendar } from "@/module/common/component/Calendar";
import * as styles from "./budget.css";

type DateFieldProps = {
    value?: string;
    onChange: (iso: string | undefined) => void;
    /** Earliest selectable day (e.g. the chosen start date). */
    minDate?: Date;
    /** Latest selectable day (e.g. the chosen end date). */
    maxDate?: Date;
};

/** Muted field showing a formatted date (or placeholder) + a calendar popover. */
export function DateField({
    value,
    onChange,
    minDate,
    maxDate,
}: DateFieldProps) {
    const { t } = useTranslation();
    const [open, setOpen] = useState(false);
    const selected = value ? new Date(value) : undefined;
    const disabled =
        minDate || maxDate
            ? (date: Date) =>
                  (minDate ? isBefore(date, minDate) : false) ||
                  (maxDate ? isAfter(date, maxDate) : false)
            : undefined;

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <button type="button" className={styles.dateField}>
                    <span
                        className={
                            selected ? styles.dateValue : styles.datePlaceholder
                        }
                    >
                        {selected
                            ? format(selected, "dd/MM/yyyy")
                            : t(
                                  "campaigns.create.budget.schedule.datePlaceholder"
                              )}
                    </span>
                    <CalendarIcon
                        width={20}
                        height={20}
                        className={styles.dateIcon}
                    />
                </button>
            </PopoverTrigger>
            <PopoverContent align="start">
                <Calendar
                    mode="single"
                    selected={selected}
                    onSelect={(date) => {
                        onChange(date?.toISOString());
                        setOpen(false);
                    }}
                    disabled={disabled}
                />
            </PopoverContent>
        </Popover>
    );
}
