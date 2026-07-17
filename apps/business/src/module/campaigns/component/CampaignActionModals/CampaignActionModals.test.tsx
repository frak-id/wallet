import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/module/campaigns/hook/useStatusTransition", () => ({
    useStatusTransition: () => ({
        mutateAsync: vi.fn(),
        isPending: false,
        isError: false,
    }),
}));
vi.mock("@/module/campaigns/hook/useDeleteCampaign", () => ({
    useDeleteCampaign: () => ({
        mutateAsync: vi.fn(),
        isPending: false,
        isError: false,
    }),
}));

const LABELS: Record<string, string> = {
    "campaigns.actions.pause": "Pause",
    "campaigns.actions.resume": "Resume",
    "campaigns.actions.archive": "Archive",
    "campaigns.actions.delete": "Delete",
};

vi.mock("react-i18next", () => ({
    useTranslation: () => ({ t: (key: string) => LABELS[key] ?? key }),
    Trans: ({ i18nKey }: { i18nKey: string }) => i18nKey,
}));

import { ModalArchive, ModalDelete, ModalPause, ModalResume } from "./index";

describe("CampaignActionModals default triggers", () => {
    const props = {
        campaignId: "c1",
        merchantId: "m1",
        campaignName: "Summer",
    };

    it("exposes an accessible name on each icon-only trigger button", () => {
        render(
            <>
                <ModalPause {...props} />
                <ModalResume {...props} />
                <ModalArchive {...props} />
                <ModalDelete {...props} />
            </>
        );
        expect(
            screen.getByRole("button", { name: "Pause" })
        ).toBeInTheDocument();
        expect(
            screen.getByRole("button", { name: "Resume" })
        ).toBeInTheDocument();
        expect(
            screen.getByRole("button", { name: "Archive" })
        ).toBeInTheDocument();
        expect(
            screen.getByRole("button", { name: "Delete" })
        ).toBeInTheDocument();
    });
});
