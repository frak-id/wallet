import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("react-i18next", () => ({
    useTranslation: () => ({ t: (key: string) => key }),
}));

const setDemoMode = vi.fn();
let demoModeState = false;

vi.mock("@/module/common/atoms/demoMode", () => ({
    useDemoMode: () => ({ isDemoMode: demoModeState, setDemoMode }),
}));

import { DemoModeCard } from "./index";

describe("DemoModeCard", () => {
    it("renders the label, description and toggle when demo mode is off", () => {
        demoModeState = false;
        render(<DemoModeCard />);

        expect(screen.getByText("settings.demo.label")).toBeInTheDocument();
        expect(
            screen.getByText("settings.demo.description")
        ).toBeInTheDocument();
        expect(screen.getByRole("switch")).not.toBeChecked();
    });

    it("reflects the active demo state on the toggle", () => {
        demoModeState = true;
        render(<DemoModeCard />);

        expect(screen.getByRole("switch")).toBeChecked();
    });
});
