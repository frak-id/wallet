import { Button, type ButtonProps } from "@frak-labs/ui/component/Button";
import { CalendarIcon } from "lucide-react";
import styles from "./index.module.css";

export const ButtonCalendar = ({ ref, children, ...props }: ButtonProps) => {
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
};

ButtonCalendar.displayName = "ButtonCalendar";
