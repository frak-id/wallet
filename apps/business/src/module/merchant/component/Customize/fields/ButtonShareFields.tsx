import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@frak-labs/design-system/components/Select";
import type { UseFormReturn } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { EditField } from "@/module/forms/EditField";
import { FormControl, FormField } from "@/module/forms/Form";
import * as styles from "../customize.css";
import type { ComponentSettingsFormValues } from "../types";
import { ComponentCssField, WordingTextField } from "./shared";

export function ButtonShareFields({
    form,
}: {
    form: UseFormReturn<ComponentSettingsFormValues>;
}) {
    const { t } = useTranslation();
    return (
        <div className={styles.settingsGrid}>
            <WordingTextField
                form={form}
                name="buttonShare.text"
                label={t("customize.components.fields.text")}
            />
            <WordingTextField
                form={form}
                name="buttonShare.noRewardText"
                label={t("customize.components.fields.noRewardText")}
            />
            <FormField
                control={form.control}
                name="buttonShare.clickAction"
                render={({ field }) => (
                    <EditField
                        label={t("customize.components.clickAction.label")}
                        hint={t("customize.components.clickAction.hint")}
                    >
                        <Select
                            value={field.value}
                            onValueChange={field.onChange}
                        >
                            <FormControl>
                                <SelectTrigger variant="bare" tone="muted">
                                    <SelectValue />
                                </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                                <SelectItem value="embedded-wallet">
                                    {t(
                                        "customize.components.clickAction.embeddedWallet"
                                    )}
                                </SelectItem>
                                <SelectItem value="share-modal">
                                    {t(
                                        "customize.components.clickAction.shareModal"
                                    )}
                                </SelectItem>
                                <SelectItem value="sharing-page">
                                    {t(
                                        "customize.components.clickAction.sharingPage"
                                    )}
                                </SelectItem>
                            </SelectContent>
                        </Select>
                    </EditField>
                )}
            />
            <ComponentCssField
                form={form}
                name="buttonShare.css"
                label={t("customize.components.fields.css")}
                placeholder={".frak-button-share { ... }"}
            />
        </div>
    );
}
