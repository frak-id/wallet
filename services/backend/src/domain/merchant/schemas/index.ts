import { t } from "@backend-utils";
import type { Static } from "elysia";

export const ExplorerConfigSchema = t.Object({
    heroImageUrl: t.Optional(t.String({ format: "uri", maxLength: 2048 })),
    logoUrl: t.Optional(t.String({ format: "uri", maxLength: 2048 })),
    description: t.Optional(t.String({ maxLength: 1000 })),
});
export type ExplorerConfig = Static<typeof ExplorerConfigSchema>;
