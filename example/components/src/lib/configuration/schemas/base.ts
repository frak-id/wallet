import { type Static, Type } from "@sinclair/typebox";

export const baseFormSchema = Type.Object({
    metadata: Type.Object({
        name: Type.String({ minLength: 3 }),
        lang: Type.String(),
        currency: Type.String(),
    }),
});

export type FormSchema = Static<typeof baseFormSchema>;
