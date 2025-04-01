import { type Static, Type } from "@sinclair/typebox";

export const loginFormSchema = Type.Object({
    description: Type.Optional(Type.String()),
    primaryAction: Type.Optional(Type.String()),
    success: Type.Optional(Type.String()),
});

export type LoginFormSchema = Static<typeof loginFormSchema>;

export const activationFormSchema = Type.Object({
    description: Type.Optional(Type.String()),
    primaryAction: Type.Optional(Type.String()),
});

export type ActivationFormSchema = Static<typeof activationFormSchema>;

export const dismissFormSchema = Type.Object({
    primaryAction: Type.Optional(Type.String()),
});

export type DismissFormSchema = Static<typeof dismissFormSchema>;

export const cssFormSchema = Type.Object({
    css: Type.Optional(Type.String()),
});

export type CssFormSchema = Static<typeof cssFormSchema>;

export const finalFormSchema = Type.Object({
    description: Type.Optional(Type.String()),
    dismissed: Type.Object({
        description: Type.Optional(Type.String()),
    }),
});

export type FinalFormSchema = Static<typeof finalFormSchema>;
