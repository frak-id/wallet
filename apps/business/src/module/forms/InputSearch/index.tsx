import { SearchIcon } from "@frak-labs/design-system/icons";
import { Input, type InputProps } from "@/module/forms/Input";

export const InputSearch = ({
    ref,
    type,
    placeholder = "Search",
    ...props
}: InputProps) => {
    return (
        <Input
            ref={ref}
            variant="soft"
            leftSection={<SearchIcon />}
            placeholder={placeholder}
            {...props}
        />
    );
};
InputSearch.displayName = "InputSearch";
