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
import type { ComponentSettingsFormValues } from "../types";

export function ButtonShareFields({
    form,
}: {
    form: UseFormReturn<ComponentSettingsFormValues>;
}) {
    return (
        <div className={styles.customizeSettingsGrid}>
            <FormField
                control={form.control}
                name="buttonShare.clickAction"
                render={({ field }) => (
                    <FormItem>
                        <FormLabel weight={"medium"}>Click action</FormLabel>
                        <FormDescription>
                            What happens when a visitor clicks the share button
                        </FormDescription>
                        <FormControl>
                            <select
                                className={styles.customizeSelect}
                                value={field.value}
                                onChange={(e) => field.onChange(e.target.value)}
                            >
                                <option value="embedded-wallet">
                                    Embedded wallet
                                </option>
                                <option value="share-modal">Share modal</option>
                                <option value="sharing-page">
                                    Sharing page
                                </option>
                            </select>
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                )}
            />

            <FormField
                control={form.control}
                name="buttonShare.css"
                render={({ field }) => (
                    <FormItem>
                        <FormLabel weight={"medium"}>Component CSS</FormLabel>
                        <FormDescription>
                            Custom styles applied to the share button
                        </FormDescription>
                        <FormControl>
                            <textarea
                                className={styles.customizeTextarea}
                                placeholder={".frak-button-share { ... }"}
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
