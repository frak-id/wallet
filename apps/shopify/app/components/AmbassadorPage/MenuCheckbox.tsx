import {
    ambassadorMenuTitle,
    ambassadorPageLanguage,
} from "app/utils/ambassadorPage";
import { useTranslation } from "react-i18next";

/** "Add a link to my main menu", titled with the exact link the action adds. */
export function MenuCheckbox({
    checked,
    onChange,
}: {
    checked: boolean;
    onChange: (checked: boolean) => void;
}) {
    const { t, i18n } = useTranslation();
    const title = ambassadorMenuTitle(ambassadorPageLanguage(i18n.language));

    return (
        <s-checkbox
            label={t("ambassadorPage.publish.addToMenu", { title })}
            checked={checked}
            onChange={(event) => onChange(event.currentTarget.checked ?? false)}
        />
    );
}
