import { CalendarIcon } from "lucide-react";
import { Button, type ButtonProps } from "@/module/common/component/Button";
import { buttonCalendarTrigger } from "./button-calendar.css";

export const ButtonCalendar = ({ ref, children, ...props }: ButtonProps) => {
    return (
        <Button
            variant={"outline"}
            className={buttonCalendarTrigger}
            ref={ref}
            {...props}
        >
            <CalendarIcon size={20} />
            {children}
        </Button>
    );
};

ButtonCalendar.displayName = "ButtonCalendar";
