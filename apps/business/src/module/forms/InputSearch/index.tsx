import { Input } from "@frak-labs/design-system/components/Input";
import { Search } from "lucide-react";
import type { ComponentProps } from "react";
import { icon } from "./input-search.css";

type InputProps = ComponentProps<typeof Input>;

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
