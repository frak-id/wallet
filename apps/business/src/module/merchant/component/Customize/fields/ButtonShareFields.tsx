import type { UseFormReturn } from "react-hook-form";
import {
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/module/forms/Form";
import { Input } from "@/module/forms/Input";
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
                name="buttonShare.text"
                rules={{
                    maxLength: {
                        value: 500,
                        message: "Maximum length is 500 characters",
                    },
                }}
                render={({ field }) => (
                    <FormItem>
                        <FormLabel weight={"medium"}>Button text</FormLabel>
                        <FormDescription>
                            Label displayed on the share button. Embed{" "}
                            <code>{"{REWARD}"}</code> to display the estimated
                            reward amount inline (e.g.{" "}
                            <em>Share and earn up to {"{REWARD}"}!</em>).
                        </FormDescription>
                        <FormControl>
                            <Input
                                length={"big"}
                                maxLength={500}
                                placeholder={"Share and earn!"}
                                {...field}
                            />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                )}
            />

            <FormField
                control={form.control}
                name="buttonShare.noRewardText"
                rules={{
                    maxLength: {
                        value: 500,
                        message: "Maximum length is 500 characters",
                    },
                }}
                render={({ field }) => (
                    <FormItem>
                        <FormLabel weight={"medium"}>
                            No-reward fallback text
                        </FormLabel>
                        <FormDescription>
                            Shown instead when the button text contains{" "}
                            <code>{"{REWARD}"}</code> but no reward is available
                            for this campaign
                        </FormDescription>
                        <FormControl>
                            <Input
                                length={"big"}
                                maxLength={500}
                                placeholder={"Share even without rewards"}
                                {...field}
                            />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                )}
            />

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
