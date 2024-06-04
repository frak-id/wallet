import { Button } from "@/module/common/component/Button";
import { Calendar } from "@/module/common/component/Calendar";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/module/common/component/Popover";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { useState } from "react";
import styles from "./index.module.css";

export function DatePicker() {
    const [field, setField] = useState<Date>();

    return (
        <Popover>
            <PopoverTrigger asChild>
                <Button
                    variant={"outline"}
                    className={styles.datePicker__trigger}
                >
                    <CalendarIcon size={20} />
                    {field ? format(field, "PPP") : <span>Pick a date</span>}
                </Button>
            </PopoverTrigger>
            <PopoverContent align="start">
                <Calendar
                    mode="single"
                    selected={field}
                    onSelect={(date) => {
                        if (!date) return;
                        setField(date);
                    }}
                    disabled={(date) => date < new Date()}
                    initialFocus
                />
            </PopoverContent>
        </Popover>
    );
}
