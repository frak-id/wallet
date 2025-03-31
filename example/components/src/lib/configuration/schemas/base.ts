import { type Static, Type } from "@sinclair/typebox";

export const baseFormSchema = Type.Object({
    metadata: Type.Object({
        name: Type.String({ minLength: 3 }),
        lang: Type.Optional(Type.String()),
        currency: Type.Optional(Type.String()),
        logoUrl: Type.Optional(Type.String()),
        homepageLink: Type.Optional(Type.String()),
    }),
});

export type FormSchema = Static<typeof baseFormSchema>;
