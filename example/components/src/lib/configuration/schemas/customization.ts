import { type Static, Type } from "@sinclair/typebox";

export const customizationFormSchema = Type.Object({
    description: Type.String({
        required: false,
    }),
    primaryAction: Type.String({
        required: false,
    }),
});

export type FormSchema = Static<typeof customizationFormSchema>;
