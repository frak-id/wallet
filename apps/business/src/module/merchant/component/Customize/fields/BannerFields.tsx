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
import type { BannerFormValues, PlacementSettingsFormValues } from "../types";

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
    form: UseFormReturn<PlacementSettingsFormValues>;
}) {
    return (
        <div className={styles.customize__settingsGrid}>
            <FormField
                control={form.control}
                name="banner.referralTitle"
                rules={{
                    maxLength: {
                        value: 500,
                        message: "Maximum length is 500 characters",
                    },
                }}
                render={({ field }) => (
                    <FormItem>
                        <FormLabel weight={"medium"}>Referral title</FormLabel>
                        <FormDescription>
                            Heading shown when a referral is detected
                        </FormDescription>
                        <FormControl>
                            <Input
                                length={"big"}
                                maxLength={500}
                                placeholder={"Earn {REWARD} on purchases"}
                                {...field}
                            />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                )}
            />

            <FormField
                control={form.control}
                name="banner.referralDescription"
                rules={{
                    maxLength: {
                        value: 500,
                        message: "Maximum length is 500 characters",
                    },
                }}
                render={({ field }) => (
                    <FormItem>
                        <FormLabel weight={"medium"}>
                            Referral description
                        </FormLabel>
                        <FormDescription>
                            Body text below the referral title
                        </FormDescription>
                        <FormControl>
                            <Input
                                length={"big"}
                                maxLength={500}
                                placeholder={
                                    "Earn rewards after your purchase via the Frak partner app."
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
                name="banner.referralCta"
                rules={{
                    maxLength: {
                        value: 200,
                        message: "Maximum length is 200 characters",
                    },
                }}
                render={({ field }) => (
                    <FormItem>
                        <FormLabel weight={"medium"}>
                            Referral CTA button
                        </FormLabel>
                        <FormDescription>
                            Dismiss button text for the referral banner
                        </FormDescription>
                        <FormControl>
                            <Input
                                length={"big"}
                                maxLength={200}
                                placeholder={"Got it"}
                                {...field}
                            />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                )}
            />

            <FormField
                control={form.control}
                name="banner.inappTitle"
                rules={{
                    maxLength: {
                        value: 500,
                        message: "Maximum length is 500 characters",
                    },
                }}
                render={({ field }) => (
                    <FormItem>
                        <FormLabel weight={"medium"}>
                            In-app browser title
                        </FormLabel>
                        <FormDescription>
                            Heading shown when an in-app browser is detected
                        </FormDescription>
                        <FormControl>
                            <Input
                                length={"big"}
                                maxLength={500}
                                placeholder={"Open in your browser"}
                                {...field}
                            />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                )}
            />

            <FormField
                control={form.control}
                name="banner.inappDescription"
                rules={{
                    maxLength: {
                        value: 500,
                        message: "Maximum length is 500 characters",
                    },
                }}
                render={({ field }) => (
                    <FormItem>
                        <FormLabel weight={"medium"}>
                            In-app browser description
                        </FormLabel>
                        <FormDescription>
                            Body text explaining why to open in external browser
                        </FormDescription>
                        <FormControl>
                            <Input
                                length={"big"}
                                maxLength={500}
                                placeholder={
                                    "For a better experience, open this page in your default browser."
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
                name="banner.inappCta"
                rules={{
                    maxLength: {
                        value: 200,
                        message: "Maximum length is 200 characters",
                    },
                }}
                render={({ field }) => (
                    <FormItem>
                        <FormLabel weight={"medium"}>
                            In-app browser CTA button
                        </FormLabel>
                        <FormDescription>
                            Button text to redirect to external browser
                        </FormDescription>
                        <FormControl>
                            <Input
                                length={"big"}
                                maxLength={200}
                                placeholder={"Open browser"}
                                {...field}
                            />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                )}
            />

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
                                className={styles.customize__textarea}
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
