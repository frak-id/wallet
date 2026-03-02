import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { campaignStore } from "@/stores/campaignStore";
import { Actions } from "./index";

const mockNavigate = vi.fn();
let mockPathname = "/campaigns/draft/new";

vi.mock("@tanstack/react-router", () => ({
    useNavigate: () => mockNavigate,
    useLocation: () => ({ pathname: mockPathname }),
}));

describe("Actions", () => {
    beforeEach(() => {
        campaignStore.getState().reset();
        mockNavigate.mockReset();
        mockPathname = "/campaigns/draft/new";
    });

    it("should reset success state on non-validation steps and show actions", async () => {
        campaignStore.getState().setSuccess(true);

        render(<Actions />);

        await waitFor(() => {
            expect(campaignStore.getState().isSuccess).toBe(false);
        });

        expect(
            screen.getByRole("button", {
                name: "Next",
            })
        ).toBeInTheDocument();
    });
});
