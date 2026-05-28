import { SearchIcon } from "@frak-labs/design-system/icons";
import { useTranslation } from "react-i18next";
import { Input, type InputProps } from "@/module/forms/Input";

export const InputSearch = ({
    ref,
    type,
    placeholder,
    ...props
}: InputProps) => {
    const { t } = useTranslation();
    return (
        <Input
            ref={ref}
            variant="soft"
            leftSection={<SearchIcon />}
            placeholder={placeholder ?? t("common.search.placeholder")}
            {...props}
        />
    );
};
InputSearch.displayName = "InputSearch";
