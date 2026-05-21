import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DemoModeSwitch } from "./index";

// Establishes the i18n test pattern for business: stub `useTranslation`
// to echo keys so assertions are stable and we don't need a full i18next
// bootstrap in unit tests.
vi.mock("react-i18next", () => ({
    useTranslation: () => ({ t: (key: string) => key }),
}));

const setDemoMode = vi.fn();
let demoModeState = false;

vi.mock("@/module/common/atoms/demoMode", () => ({
    useDemoMode: () => ({ isDemoMode: demoModeState, setDemoMode }),
}));

describe("DemoModeSwitch", () => {
    it("renders label and description when demo mode is off", () => {
        demoModeState = false;
        render(<DemoModeSwitch />);

        expect(screen.getByText("settings.demo.label")).toBeInTheDocument();
        expect(
            screen.getByText("settings.demo.description")
        ).toBeInTheDocument();
        expect(
            screen.queryByText("settings.demo.active")
        ).not.toBeInTheDocument();
    });

    it("shows the active callout when demo mode is on", () => {
        demoModeState = true;
        render(<DemoModeSwitch />);

        expect(screen.getByText("settings.demo.active")).toBeInTheDocument();
    });
});
