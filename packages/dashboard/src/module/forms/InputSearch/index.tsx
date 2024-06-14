import { Input } from "@/module/forms/Input";
import { Search } from "lucide-react";
import { forwardRef } from "react";
import type { ChangeEvent, InputHTMLAttributes, ReactNode } from "react";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
    classNameWrapper?: string;
    defaultValue?: string;
    value?: string;
    onChange?: (event: ChangeEvent<HTMLInputElement>) => void;
    onChangeValue?: (value: string | undefined) => void;
    leftSection?: string | ReactNode;
}

export const InputSearch = forwardRef<HTMLInputElement, InputProps>(
    (
        { type, className = "", classNameWrapper = "", leftSection, ...props },
        ref
    ) => {
        return (
            <Input
                ref={ref}
                className={className}
                classNameWrapper={classNameWrapper}
                leftSection={<Search size={24} />}
                {...props}
            />
        );
    }
);
InputSearch.displayName = "InputSearch";
