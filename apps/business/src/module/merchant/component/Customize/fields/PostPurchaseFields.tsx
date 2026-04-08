import type { SdkConfig } from "@frak-labs/backend-elysia/domain/merchant";
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
import styles from "../index.module.css";
import type {
    PlacementSettingsFormValues,
    PostPurchaseFormValues,
} from "../types";

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
    form: UseFormReturn<PlacementSettingsFormValues>;
}) {
    return (
        <div className={styles.customize__settingsGrid}>
            <FormField
                control={form.control}
                name="postPurchase.refereeText"
                rules={{
                    maxLength: {
                        value: 500,
                        message: "Maximum length is 500 characters",
                    },
                }}
                render={({ field }) => (
                    <FormItem>
                        <FormLabel weight={"medium"}>
                            Referee message (with reward)
                        </FormLabel>
                        <FormDescription>
                            Shown to referred visitors after purchase. Use
                            {"  {REWARD}  "} for the reward amount.
                        </FormDescription>
                        <FormControl>
                            <Input
                                length={"big"}
                                maxLength={500}
                                placeholder={
                                    "You just earned {REWARD}! Share with friends to earn even more."
                                }
                                {...field}
                            />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                )}
            />

            <FormField
                control={form.control}
                name="postPurchase.refereeNoRewardText"
                rules={{
                    maxLength: {
                        value: 500,
                        message: "Maximum length is 500 characters",
                    },
                }}
                render={({ field }) => (
                    <FormItem>
                        <FormLabel weight={"medium"}>
                            Referee message (no reward)
                        </FormLabel>
                        <FormDescription>
                            Fallback for referred visitors when no reward is
                            available
                        </FormDescription>
                        <FormControl>
                            <Input
                                length={"big"}
                                maxLength={500}
                                placeholder={
                                    "You just earned a reward! Share with friends to earn even more."
                                }
                                {...field}
                            />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                )}
            />

            <FormField
                control={form.control}
                name="postPurchase.referrerText"
                rules={{
                    maxLength: {
                        value: 500,
                        message: "Maximum length is 500 characters",
                    },
                }}
                render={({ field }) => (
                    <FormItem>
                        <FormLabel weight={"medium"}>
                            Referrer message (with reward)
                        </FormLabel>
                        <FormDescription>
                            Shown to non-referred visitors after purchase. Use{" "}
                            {"  {REWARD}  "} for the reward amount.
                        </FormDescription>
                        <FormControl>
                            <Input
                                length={"big"}
                                maxLength={500}
                                placeholder={
                                    "Earn {REWARD} by sharing this with your friends!"
                                }
                                {...field}
                            />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                )}
            />

            <FormField
                control={form.control}
                name="postPurchase.referrerNoRewardText"
                rules={{
                    maxLength: {
                        value: 500,
                        message: "Maximum length is 500 characters",
                    },
                }}
                render={({ field }) => (
                    <FormItem>
                        <FormLabel weight={"medium"}>
                            Referrer message (no reward)
                        </FormLabel>
                        <FormDescription>
                            Fallback for non-referred visitors when no reward is
                            available
                        </FormDescription>
                        <FormControl>
                            <Input
                                length={"big"}
                                maxLength={500}
                                placeholder={
                                    "Share this with your friends and earn rewards!"
                                }
                                {...field}
                            />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                )}
            />

            <FormField
                control={form.control}
                name="postPurchase.ctaText"
                rules={{
                    maxLength: {
                        value: 200,
                        message: "Maximum length is 200 characters",
                    },
                }}
                render={({ field }) => (
                    <FormItem>
                        <FormLabel weight={"medium"}>
                            CTA button (with reward)
                        </FormLabel>
                        <FormDescription>
                            Share button text. Use {"  {REWARD}  "} for the
                            reward amount.
                        </FormDescription>
                        <FormControl>
                            <Input
                                length={"big"}
                                maxLength={200}
                                placeholder={"Share & earn {REWARD}"}
                                {...field}
                            />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                )}
            />

            <FormField
                control={form.control}
                name="postPurchase.ctaNoRewardText"
                rules={{
                    maxLength: {
                        value: 200,
                        message: "Maximum length is 200 characters",
                    },
                }}
                render={({ field }) => (
                    <FormItem>
                        <FormLabel weight={"medium"}>
                            CTA button (no reward)
                        </FormLabel>
                        <FormDescription>
                            Fallback button text when no reward is available
                        </FormDescription>
                        <FormControl>
                            <Input
                                length={"big"}
                                maxLength={200}
                                placeholder={"Share & earn"}
                                {...field}
                            />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                )}
            />

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
                                className={styles.customize__textarea}
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
