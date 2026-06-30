import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import type { BillingInfo } from "./types";
import { useBillingInfo, useBillingStore } from "./useBillingInfo";

const INFO: BillingInfo = {
    companyName: "Nowa",
    vatNumber: "FR76485215479",
    streetAddress: "42 rue Legendre",
    city: "Paris",
    postalCode: "75017",
    country: "FR",
    billingEmail: "nowa@nowa-water.com",
};

describe("useBillingInfo", () => {
    beforeEach(() => {
        useBillingStore.setState({ info: null });
    });

    it("starts empty so the 'missing infos' state renders first", () => {
        const { result } = renderHook(() => useBillingInfo());
        expect(result.current.info).toBeNull();
        expect(result.current.hasInfo).toBe(false);
    });

    it("always exposes the stub invoices and deposits", () => {
        const { result } = renderHook(() => useBillingInfo());
        expect(result.current.invoices.length).toBe(7);
        expect(result.current.deposits.length).toBe(4);
        expect(result.current.invoices.every((e) => e.kind === "invoice")).toBe(
            true
        );
        expect(result.current.deposits.every((e) => e.kind === "deposit")).toBe(
            true
        );
    });

    it("saveInfo persists the info and flips hasInfo", () => {
        const { result } = renderHook(() => useBillingInfo());
        act(() => result.current.saveInfo(INFO));
        expect(result.current.info).toEqual(INFO);
        expect(result.current.hasInfo).toBe(true);
    });
});
