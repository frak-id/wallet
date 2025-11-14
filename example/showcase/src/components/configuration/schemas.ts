import { z } from "zod";

export const baseConfigSchema = z.object({
    name: z
        .string()
        .min(1, "configuration.baseForm.nameRequired")
        .max(100, "Application name must be less than 100 characters"),
    lang: z.enum(["auto", "en", "fr"]).default("auto"),
    currency: z.enum(["eur", "usd", "gbp"]).default("eur"),
    logoUrl: z
        .string()
        .url("configuration.baseForm.logoUrlInvalid")
        .optional()
        .or(z.literal("")),
    homepageLink: z
        .string()
        .url("configuration.baseForm.homepageLinkInvalid")
        .optional()
        .or(z.literal("")),
});

export type BaseConfigFormData = z.infer<typeof baseConfigSchema>;

export const loginFormSchema = z.object({
    description: z.string().optional(),
    primaryAction: z.string().optional(),
    success: z.string().optional(),
});

export type LoginFormData = z.infer<typeof loginFormSchema>;

export const activationFormSchema = z.object({
    description: z.string().optional(),
    primaryAction: z.string().optional(),
});

export type ActivationFormData = z.infer<typeof activationFormSchema>;

export const dismissFormSchema = z.object({
    primaryAction: z.string().optional(),
});

export type DismissFormData = z.infer<typeof dismissFormSchema>;

export const finalFormSchema = z.object({
    description: z.string().optional(),
    dismissed: z
        .object({
            description: z.string().optional(),
        })
        .optional(),
});

export type FinalFormData = z.infer<typeof finalFormSchema>;

export const cssFormSchema = z.object({
    css: z.string().optional(),
});

export type CssFormData = z.infer<typeof cssFormSchema>;
