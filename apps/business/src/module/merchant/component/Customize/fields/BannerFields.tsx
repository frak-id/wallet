import type { SdkConfig } from "@frak-labs/backend-elysia/domain/merchant";
import type { UseFormReturn } from "react-hook-form";
import {
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/module/forms/Form";
import * as styles from "../customize.css";
import type { BannerFormValues, ComponentSettingsFormValues } from "../types";

// Text fields have no UI (Frak-managed wording) but are still loaded into the form
// so they round-trip unchanged on save. Keep them — dropping wipes merchant wording.
export function getBannerDefaults(
    components: NonNullable<
        NonNullable<SdkConfig["placements"]>[string]
    >["components"]
): BannerFormValues {
    const b = components?.banner;
    return {
        referralTitle: b?.referralTitle ?? "",
        referralDescription: b?.referralDescription ?? "",
        referralCta: b?.referralCta ?? "",
        inappTitle: b?.inappTitle ?? "",
        inappDescription: b?.inappDescription ?? "",
        inappCta: b?.inappCta ?? "",
        css: b?.rawCss ?? "",
    };
}

export function BannerFields({
    form,
}: {
    form: UseFormReturn<ComponentSettingsFormValues>;
}) {
    return (
        <div className={styles.customizeSettingsGrid}>
            <FormField
                control={form.control}
                name="banner.css"
                render={({ field }) => (
                    <FormItem>
                        <FormLabel weight={"medium"}>Component CSS</FormLabel>
                        <FormDescription>
                            Custom styles applied to the banner component
                        </FormDescription>
                        <FormControl>
                            <textarea
                                className={styles.customizeTextarea}
                                placeholder={".frak-banner { ... }"}
                                rows={4}
                                {...field}
                            />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                )}
            />
        </div>
    );
}
