import { Input } from "@frak-labs/ui/component/forms/Input";
import type { UseFormReturn } from "react-hook-form";
import {
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/module/forms/Form";
import { Switch } from "@/module/forms/Switch";
import styles from "../index.module.css";
import type { ComponentSettingsFormValues } from "../types";

export function ButtonShareFields({
    form,
}: {
    form: UseFormReturn<ComponentSettingsFormValues>;
}) {
    return (
        <div className={styles.customize__settingsGrid}>
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
                            Label displayed on the share button
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
                            Shown instead when no reward is available for this
                            campaign
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
                                className={styles.customize__select}
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
                name="buttonShare.useReward"
                render={({ field }) => (
                    <FormItem className={styles.customize__switchRow}>
                        <FormLabel weight={"medium"}>
                            Display estimated reward
                        </FormLabel>
                        <FormDescription>
                            Show the estimated reward amount directly on the
                            button
                        </FormDescription>
                        <FormControl>
                            <Switch
                                checked={field.value}
                                onCheckedChange={field.onChange}
                            />
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
                                className={styles.customize__textarea}
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
