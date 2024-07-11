import { Input } from "@module/component/forms/Input";
import type { InputProps } from "@module/component/forms/Input";
import { Search } from "lucide-react";
import { forwardRef } from "react";
import type { InputHTMLAttributes } from "react";
import styles from "./index.module.css";

export interface InputSearchProps
    extends InputHTMLAttributes<HTMLInputElement> {}

export const InputSearch = forwardRef<
    HTMLInputElement,
    InputSearchProps & InputProps
>(({ type, ...props }, ref) => {
    return (
        <Input
            ref={ref}
            leftSection={
                <span className={styles.icon}>
                    <Search size={24} />
                </span>
            }
            {...props}
        />
    );
});
InputSearch.displayName = "InputSearch";
