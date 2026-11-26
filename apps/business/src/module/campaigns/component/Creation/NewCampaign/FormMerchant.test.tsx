import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("react-i18next", () => ({
    useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("@tanstack/react-router", () => ({
    useNavigate: () => vi.fn(),
}));

const merchantsMock = vi.hoisted(() => ({
    merchants: [] as Array<{ id: string; name: string; domain: string }>,
}));

vi.mock("@/module/dashboard/hooks/useMyMerchants", () => ({
    useMyMerchants: () => ({ merchants: merchantsMock.merchants }),
}));

import { FormMerchant } from "./FormMerchant";

const SHOP = { id: "m1", name: "Shop", domain: "shop.example" };
const OTHER = { id: "m2", name: "Other", domain: "other.example" };

describe("FormMerchant", () => {
    beforeEach(() => {
        merchantsMock.merchants = [];
    });

    it("shows a single store as plain text, without a select or description", () => {
        merchantsMock.merchants = [SHOP];
        render(<FormMerchant merchantId="m1" />);

        expect(screen.getByText("shop.example")).toBeInTheDocument();
        expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
        expect(
            screen.queryByText("campaigns.create.basics.merchant.description")
        ).not.toBeInTheDocument();
    });

    it("keeps the select and explains the reset when there are several stores", () => {
        merchantsMock.merchants = [SHOP, OTHER];
        render(<FormMerchant merchantId="m1" />);

        expect(screen.getByRole("combobox")).toBeInTheDocument();
        expect(
            screen.getByText("campaigns.create.basics.merchant.description")
        ).toBeInTheDocument();
    });
});
