import { Button, type ButtonProps } from "@module/component/Button";
import { CalendarIcon } from "lucide-react";
import { forwardRef } from "react";
import styles from "./index.module.css";

export const ButtonCalendar = forwardRef<HTMLButtonElement, ButtonProps>(
    ({ children, ...props }, ref) => {
        return (
            <Button
                variant={"outline"}
                className={styles.buttonCalendar__trigger}
                ref={ref}
                {...props}
            >
                <CalendarIcon size={20} />
                {children}
            </Button>
        );
    }
);

ButtonCalendar.displayName = "ButtonCalendar";
