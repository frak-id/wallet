import { type Static, Type } from "@sinclair/typebox";

export const customizationFormSchema = Type.Object({
    description: Type.Optional(Type.String()),
    primaryAction: Type.Optional(Type.String()),
});

export type FormSchema = Static<typeof customizationFormSchema>;
