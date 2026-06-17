import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BigNumber } from "./parts";
import { truncateWallet } from "./truncateWallet";

describe("truncateWallet", () => {
    it("shortens a full address to head…tail", () => {
        expect(truncateWallet("0x742d35Cc6634C0532925a3b8D4f9f0bEb0")).toBe(
            "0x742d…f0bEb0"
        );
    });

    it("returns short inputs unchanged (no overlap)", () => {
        expect(truncateWallet("0xABCD")).toBe("0xABCD");
        // 13 chars — boundary, still returned as-is
        expect(truncateWallet("0x12345678901")).toBe("0x12345678901");
    });
});

describe("BigNumber", () => {
    const eur = new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "EUR",
        maximumFractionDigits: 2,
    });

    it("exposes the full formatted value to assistive tech via aria-label", () => {
        const { container } = render(<BigNumber format={eur} value={3103.8} />);
        const node = container.querySelector('[role="img"]');
        expect(node?.getAttribute("aria-label")).toBe(eur.format(3103.8));
    });

    it("splits currency cents into a separate (smaller) span", () => {
        const { container } = render(<BigNumber format={eur} value={3103.8} />);
        // integer part + currency render as plain text; ".80" lives in its
        // own span so it can be styled smaller.
        const spans = container.querySelectorAll("span span");
        const fraction = Array.from(spans).find((s) =>
            s.textContent?.includes("80")
        );
        expect(fraction).toBeDefined();
    });

    it("renders non-currency values as a single uniform string", () => {
        const percent = new Intl.NumberFormat("en-US", {
            style: "percent",
            maximumFractionDigits: 0,
        });
        const { container } = render(
            <BigNumber format={percent} value={0.57} />
        );
        expect(container.textContent).toBe("57%");
        // no inner fraction span for non-currency
        expect(container.querySelectorAll("span span")).toHaveLength(0);
    });

    it("prepends the prefix and includes it in the aria-label", () => {
        const decimal = new Intl.NumberFormat("en-US", {
            maximumFractionDigits: 1,
        });
        const { container } = render(
            <BigNumber format={decimal} value={2.6} prefix="x" />
        );
        expect(container.textContent).toBe("x2.6");
        expect(
            container.querySelector('[role="img"]')?.getAttribute("aria-label")
        ).toBe("x2.6");
    });
});
