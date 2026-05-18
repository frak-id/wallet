import { CalendarIcon } from "lucide-react";
import type { ButtonHTMLAttributes, Ref } from "react";
import { Button } from "@/module/common/component/Button";
import { buttonCalendarTrigger } from "./button-calendar.css";

type ButtonCalendarProps = ButtonHTMLAttributes<HTMLButtonElement> & {
    ref?: Ref<HTMLButtonElement>;
};

export const ButtonCalendar = ({
    ref,
    children,
    ...props
}: ButtonCalendarProps) => {
    return (
        <Button
            variant="secondary"
            icon={<CalendarIcon size={20} />}
            className={buttonCalendarTrigger}
            ref={ref}
            {...props}
        >
            {children}
        </Button>
    );
};

ButtonCalendar.displayName = "ButtonCalendar";
