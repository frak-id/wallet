import { t } from "@backend-utils";

export const identityHeadersSchema = t.Object({
    "x-frak-client-id": t.Optional(t.String()),
});
