import { useTranslation } from "react-i18next";
import {
    SheetScreen,
    type SheetScreenProps,
} from "@/module/common/component/SheetScreen";
import { getMoneriumErrorKey } from "@/module/monerium/utils/moneriumErrors";

type MoneriumScreenProps = Omit<SheetScreenProps, "errorMessage"> & {
    /** Rendered after the children, as Monerium error copy. */
    error?: unknown;
};

/** Shared layout for every Monerium bank-flow screen. */
export function MoneriumScreen({ error, ...props }: MoneriumScreenProps) {
    const { t } = useTranslation();
    return (
        <SheetScreen
            {...props}
            errorMessage={error ? t(getMoneriumErrorKey(error)) : undefined}
        />
    );
}
