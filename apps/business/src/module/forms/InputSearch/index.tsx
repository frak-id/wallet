import { Search } from "lucide-react";
import { Input, type InputProps } from "@/module/forms/Input";
import { icon } from "./input-search.css";

export const InputSearch = ({ ref, type, ...props }: InputProps) => {
    return (
        <Input
            ref={ref}
            leftSection={
                <span className={icon}>
                    <Search size={24} />
                </span>
            }
            {...props}
        />
    );
};
InputSearch.displayName = "InputSearch";
