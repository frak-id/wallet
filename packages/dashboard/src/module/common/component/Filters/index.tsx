import { Button } from "@/module/common/component/Button";
import { Calendar } from "@/module/common/component/Calendar";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/module/common/component/Popover";
import { InputSearch } from "@/module/forms/InputSearch";
import { format, isBefore, startOfDay } from "date-fns";
import { CalendarIcon, SlidersHorizontal } from "lucide-react";
import { useState } from "react";
import styles from "./index.module.css";

export function Filters() {
    const [isPopoverOpen, setIsPopoverOpen] = useState(false);
    const [date, setDate] = useState<Date>(new Date());
    return (
        <div className={styles.filters}>
            <div className={styles.filters__item}>
                <InputSearch
                    placeholder={"Search campaign..."}
                    classNameWrapper={styles.filters__search}
                />
            </div>
            <div className={styles.filters__item}>
                <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
                    <PopoverTrigger asChild>
                        <Button
                            variant={"secondary"}
                            className={styles.filters__datePickerTrigger}
                        >
                            <CalendarIcon size={20} />
                            <span>{date && format(date, "PPP")}</span>
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent align="end">
                        <Calendar
                            mode="single"
                            selected={date}
                            onSelect={(value) => {
                                if (!value) return;
                                setDate(value);
                                setIsPopoverOpen(false);
                            }}
                            disabled={(date) =>
                                isBefore(date, startOfDay(new Date()))
                            }
                            initialFocus={true}
                        />
                    </PopoverContent>
                </Popover>
                <Button
                    variant={"secondary"}
                    leftIcon={<SlidersHorizontal size={20} />}
                >
                    Filters
                </Button>
            </div>
        </div>
    );
}
