import type { SdkConfig } from "@frak-labs/backend-elysia/domain/merchant";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("react-i18next", () => ({
    useTranslation: () => ({ t: (key: string) => key }),
}));

const editSdkConfig = vi.fn().mockResolvedValue(undefined);
vi.mock("@/module/merchant/hook/useMerchantUpdate", () => ({
    useMerchantUpdate: () => ({ mutateAsync: editSdkConfig, isSuccess: false }),
}));

type SectionSubmit = (values: unknown) => Promise<unknown>;
const registerSection = vi.fn<(key: string, onValid: SectionSubmit) => void>();
const onDirtyChange = vi.fn();
vi.mock("../saveRegistry", () => ({
    useCustomizeSection: (
        key: string,
        form: { formState: { isDirty: boolean } },
        onValid: (values: unknown) => Promise<unknown>
    ) => {
        registerSection(key, onValid);
        onDirtyChange(key, form.formState.isDirty);
    },
}));

import { SHARING_PRESETS } from "./presets";
import { SharingWordingPanel } from "./SharingWordingPanel";

function renderPanel(translations?: SdkConfig["translations"]) {
    return render(
        <SharingWordingPanel
            merchantId="merchant-1"
            sdkConfig={{ translations } as SdkConfig}
            shopName="Nowa"
        />
    );
}

describe("SharingWordingPanel", () => {
    beforeEach(() => vi.clearAllMocks());

    it("renders the card heading and both wording fields", () => {
        renderPanel();
        expect(screen.getByText("customize.sharing.title")).toBeInTheDocument();
        expect(
            screen.getByLabelText("customize.sharing.fields.title.label")
        ).toBeInTheDocument();
        expect(
            screen.getByLabelText("customize.sharing.fields.text.label")
        ).toBeInTheDocument();
    });

    it("offers one radio per preset, brand-substituted", () => {
        renderPanel();
        expect(screen.getAllByRole("radio")).toHaveLength(
            SHARING_PRESETS.length
        );
        expect(screen.getByText("A gift from Nowa")).toBeInTheDocument();
    });

    // The bundled default keeps `{{productName}}` in its stored value, so the
    // picker is where a raw token would reach a merchant's eyes.
    it("shows no interpolation token in the picker", () => {
        const { container } = renderPanel();
        expect(container.textContent).not.toContain("{{productName}}");
        expect(container.textContent).not.toContain("{Brand}");
        expect(screen.getByText("Nowa invite link")).toBeInTheDocument();
    });

    it("shows the stored override for the active language tier", () => {
        renderPanel({ default: { "sharing.title": "Stored title" } });
        expect(
            screen.getByLabelText("customize.sharing.fields.title.label")
        ).toHaveValue("Stored title");
    });

    // The `default` tier wins the backend cascade, so a preset must clear it or
    // the copy just picked stays invisible.
    it("clears the default tier when a preset is picked", () => {
        renderPanel({ default: { "sharing.title": "Stored title" } });
        fireEvent.click(screen.getAllByRole("radio")[1]);
        expect(
            screen.getByLabelText("customize.sharing.fields.title.label")
        ).toHaveValue("");
    });

    it("registers itself with the page-level save under its own key", () => {
        renderPanel();
        expect(registerSection).toHaveBeenCalledWith(
            "default-sharing",
            expect.any(Function)
        );
    });

    it("reports itself dirty once a field is edited", () => {
        renderPanel();
        onDirtyChange.mockClear();
        fireEvent.change(
            screen.getByLabelText("customize.sharing.fields.text.label"),
            { target: { value: "Edited" } }
        );
        expect(onDirtyChange).toHaveBeenLastCalledWith("default-sharing", true);
    });

    it("saves the edited tier as a translation key", async () => {
        renderPanel();
        fireEvent.change(
            screen.getByLabelText("customize.sharing.fields.title.label"),
            { target: { value: "My share title" } }
        );
        const lastCall = registerSection.mock.lastCall;
        if (!lastCall) throw new Error("section was never registered");
        const [, onValid] = lastCall;
        await onValid({
            title: { default: "My share title", en: "", fr: "" },
            text: { default: "", en: "", fr: "" },
        });
        expect(editSdkConfig).toHaveBeenCalledWith({
            translations: { default: { "sharing.title": "My share title" } },
        });
    });
});
