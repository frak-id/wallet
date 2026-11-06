import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
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

function OpenedFromState() {
    const [open, setOpen] = useState(false);
    return (
        <>
            <button type="button" onClick={() => setOpen(true)}>
                Open
            </button>
            <ResponsiveModal
                open={open}
                onOpenChange={setOpen}
                title="Accessible title"
                description="Accessible description"
            >
                <button type="button" onClick={() => setOpen(false)}>
                    Done
                </button>
            </ResponsiveModal>
        </>
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

    it.each([
        ["Dialog", true],
        ["Drawer", false],
    ])(
        "should return focus to the opener when the %s closes",
        async (_, isDesktop) => {
            useMediaQuery.mockReturnValue(isDesktop);
            const user = userEvent.setup();
            render(<OpenedFromState />);
            const opener = screen.getByRole("button", { name: "Open" });
            await user.click(opener);
            // A pointer click inside vaul's sheet calls setPointerCapture, which jsdom lacks.
            fireEvent.click(
                await screen.findByRole("button", { name: "Done" })
            );
            await waitFor(() => expect(opener).toHaveFocus());
        }
    );
});
