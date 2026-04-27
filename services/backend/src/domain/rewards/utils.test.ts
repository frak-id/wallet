import { describe, expect, it } from "vitest";
import { purchaseExternalEventId } from "./utils";

describe("purchaseExternalEventId", () => {
    it("namespaces the externalId under the `purchase:` prefix", () => {
        expect(purchaseExternalEventId("order-42")).toBe("purchase:order-42");
    });

    it("preserves numeric-looking ids verbatim (Shopify uses them)", () => {
        expect(purchaseExternalEventId("4210000123456")).toBe(
            "purchase:4210000123456"
        );
    });
});
