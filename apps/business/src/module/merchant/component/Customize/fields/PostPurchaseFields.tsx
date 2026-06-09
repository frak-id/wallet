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
import type {
    ComponentSettingsFormValues,
    PostPurchaseFormValues,
} from "../types";

// Text fields have no UI (Frak-managed wording) but are still loaded into the form
// so they round-trip unchanged on save. Keep them — dropping wipes merchant wording.
export function getPostPurchaseDefaults(
    components: NonNullable<
        NonNullable<SdkConfig["placements"]>[string]
    >["components"]
): PostPurchaseFormValues {
    const pp = components?.postPurchase;
    return {
        refereeText: pp?.refereeText ?? "",
        refereeNoRewardText: pp?.refereeNoRewardText ?? "",
        referrerText: pp?.referrerText ?? "",
        referrerNoRewardText: pp?.referrerNoRewardText ?? "",
        ctaText: pp?.ctaText ?? "",
        ctaNoRewardText: pp?.ctaNoRewardText ?? "",
        css: pp?.rawCss ?? "",
    };
}

export function PostPurchaseFields({
    form,
}: {
    form: UseFormReturn<ComponentSettingsFormValues>;
}) {
    return (
        <div className={styles.customizeSettingsGrid}>
            <FormField
                control={form.control}
                name="postPurchase.css"
                render={({ field }) => (
                    <FormItem>
                        <FormLabel weight={"medium"}>Component CSS</FormLabel>
                        <FormDescription>
                            Custom styles applied to the post-purchase card
                        </FormDescription>
                        <FormControl>
                            <textarea
                                className={styles.customizeTextarea}
                                placeholder={".post-purchase { ... }"}
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
