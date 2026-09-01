import type { SdkConfig } from "@frak-labs/backend-elysia/domain/merchant";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("react-i18next", () => ({
    useTranslation: () => ({ t: (key: string) => key }),
}));

const editSdkConfig = vi.fn().mockResolvedValue(undefined);
vi.mock("@/module/merchant/hook/useMerchantUpdate", () => ({
    useMerchantUpdate: () => ({ mutateAsync: editSdkConfig, isSuccess: false }),
}));

import { CustomizeSaveProvider } from "../saveRegistry";
import { SHARING_PRESETS } from "./presets";
import { SharingWordingPanel } from "./SharingWordingPanel";
import { SECTION_KEYS } from "./sections";

/**
 * The real `useCustomizeSection` runs here — only the mutation is mocked, so
 * the fireEvent -> RHF -> handleSubmit -> codec -> PUT chain is exercised whole.
 */
const sections = new Map<string, () => Promise<void>>();
const dirty: Record<string, boolean> = {};

function renderPanel(translations?: SdkConfig["translations"]) {
    sections.clear();
    for (const key of Object.keys(dirty)) delete dirty[key];
    return render(
        <CustomizeSaveProvider
            value={{
                registerSection: (key, submit) => {
                    sections.set(key, submit);
                    return () => sections.delete(key);
                },
                onDirtyChange: (key, isDirty) => {
                    dirty[key] = isDirty;
                },
            }}
        >
            <SharingWordingPanel
                merchantId="merchant-1"
                sdkConfig={{ translations } as SdkConfig}
                shopName="Nowa"
            />
        </CustomizeSaveProvider>
    );
}

/** Drive the page-level Save exactly as `useSectionedSave` does. */
async function save() {
    const submit = sections.get(SECTION_KEYS.sharing);
    if (!submit) throw new Error("sharing section never registered");
    await act(() => submit());
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

    // The backend resolves `{ ...default, ...lang }`, so a stale `default` only
    // shows for a language the preset left unwritten — copy nobody chose.
    it("clears the default tier when a preset is picked", () => {
        renderPanel({ default: { "sharing.title": "Stored title" } });
        fireEvent.click(screen.getAllByRole("radio")[1]);
        expect(
            screen.getByLabelText("customize.sharing.fields.title.label")
        ).toHaveValue("");
    });

    it("registers itself with the page-level save under its own key", () => {
        renderPanel();
        expect(sections.has(SECTION_KEYS.sharing)).toBe(true);
    });

    it("reports itself dirty once a field is edited", () => {
        renderPanel();
        expect(dirty[SECTION_KEYS.sharing]).toBe(false);
        fireEvent.change(
            screen.getByLabelText("customize.sharing.fields.text.label"),
            { target: { value: "Edited" } }
        );
        expect(dirty[SECTION_KEYS.sharing]).toBe(true);
    });

    // Drives the whole chain from the typed value, not a hand-built fixture:
    // what the merchant edits is what reaches the mutation body.
    it("saves what was typed, as a translation key", async () => {
        renderPanel();
        fireEvent.change(
            screen.getByLabelText("customize.sharing.fields.title.label"),
            { target: { value: "My share title" } }
        );
        await save();
        expect(editSdkConfig).toHaveBeenCalledWith({
            translations: { default: { "sharing.title": "My share title" } },
        });
    });

    it("writes both languages when a preset is picked", async () => {
        renderPanel();
        fireEvent.click(screen.getAllByRole("radio")[1]);
        await save();
        const preset = SHARING_PRESETS[1];
        expect(editSdkConfig).toHaveBeenCalledWith({
            translations: {
                en: {
                    "sharing.title": preset.en.title.replace(
                        /\{Brand\}/g,
                        "Nowa"
                    ),
                    "sharing.text": preset.en.text.replace(
                        /\{Brand\}/g,
                        "Nowa"
                    ),
                },
                fr: {
                    "sharing.title": preset.fr.title.replace(
                        /\{Brand\}/g,
                        "Nowa"
                    ),
                    "sharing.text": preset.fr.text.replace(
                        /\{Brand\}/g,
                        "Nowa"
                    ),
                },
            },
        });
    });

    // The defect the codec's null return exists for: an absent key leaves the
    // route's stored dictionary untouched, so the clear must serialise.
    it("sends null when every field is cleared", async () => {
        renderPanel({ default: { "sharing.title": "Stored title" } });
        fireEvent.change(
            screen.getByLabelText("customize.sharing.fields.title.label"),
            { target: { value: "" } }
        );
        await save();
        expect(editSdkConfig).toHaveBeenCalledWith({ translations: null });
    });
});
