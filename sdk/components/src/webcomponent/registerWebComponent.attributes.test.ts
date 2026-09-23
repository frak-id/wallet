import { h } from "preact";
import { describe, expect, it, vi } from "vitest";
import { registerWebComponent } from "./registerWebComponent";

vi.mock("../bootstrap/initFrakSdk", () => ({ initFrakSdk: vi.fn() }));

type Props = { customerId?: string };

function Probe({ customerId }: Props) {
    return h("span", null, customerId ?? "none");
}

describe("registerWebComponent", () => {
    it("re-renders when a dash-case attribute changes after mount", () => {
        registerWebComponent<Props>(Probe, "frak-test-probe", ["customerId"], {
            shadow: false,
        });
        const el = document.createElement("frak-test-probe");
        document.body.append(el);
        expect(el.textContent).toBe("none");

        el.setAttribute("customer-id", "c-1");

        expect(el.textContent).toBe("c-1");
        el.remove();
    });

    it("keeps the camelCase property working", () => {
        registerWebComponent<Props>(Probe, "frak-test-probe", ["customerId"], {
            shadow: false,
        });
        const el = document.createElement("frak-test-probe") as HTMLElement &
            Props;
        document.body.append(el);

        el.customerId = "c-2";

        expect(el.textContent).toBe("c-2");
        el.remove();
    });
});
