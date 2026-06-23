import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ResponsiveModal } from "./index";

const useMediaQuery = vi.hoisted(() => vi.fn());

vi.mock("../../hooks/useMediaQuery", () => ({ useMediaQuery }));

function renderModal() {
    return render(
        <ResponsiveModal
            open
            onOpenChange={() => {}}
            title="Accessible title"
            description="Accessible description"
            header={<span>header-slot</span>}
        >
            <p>Modal body</p>
        </ResponsiveModal>
    );
}

describe("ResponsiveModal", () => {
    afterEach(() => {
        useMediaQuery.mockReset();
    });

    it("should render the Dialog variant on tablet and up", () => {
        useMediaQuery.mockReturnValue(true);
        renderModal();
        expect(screen.getByText("Modal body")).toBeInTheDocument();
        expect(screen.getByText("header-slot")).toBeInTheDocument();
        expect(screen.getByText("Accessible title")).toBeInTheDocument();
        expect(screen.getByText("Accessible description")).toBeInTheDocument();
    });

    it("should render the Drawer variant on mobile", () => {
        useMediaQuery.mockReturnValue(false);
        renderModal();
        expect(screen.getByText("Modal body")).toBeInTheDocument();
        expect(screen.getByText("header-slot")).toBeInTheDocument();
        expect(screen.getByText("Accessible title")).toBeInTheDocument();
        expect(screen.getByText("Accessible description")).toBeInTheDocument();
    });
});
