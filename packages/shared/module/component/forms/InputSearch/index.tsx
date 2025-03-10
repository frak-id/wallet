import { Input, type InputProps } from "@shared/module/component/forms/Input";
import { Search } from "lucide-react";
import styles from "./index.module.css";

export const InputSearch = ({ ref, type, ...props }: InputProps) => {
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
};
InputSearch.displayName = "InputSearch";
