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

function renderPanel(
    translations?: SdkConfig["translations"],
    config?: Partial<SdkConfig>
) {
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
                sdkConfig={{ translations, ...config } as SdkConfig}
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

    // Preset labels are brand-substituted for display while the stored value
    // keeps its tokens. Token-scrubbing across the whole panel is covered by
    // the preview suite.
    it("labels the bundled preset with the shop name", () => {
        renderPanel();
        expect(
            screen.getAllByRole("radio", { name: /Nowa invite link/ })
        ).toHaveLength(1);
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

describe("SharingWordingPanel preview", () => {
    beforeEach(() => vi.clearAllMocks());

    /**
     * The rendered preview, scoped past the card header so a `p`/`img` lookup
     * cannot match the panel's own chrome. Keyed on `data-testid`, not the
     * vanilla-extract class name, which is only readable while identifiers
     * default to "debug". Throws rather than defaulting: a structural
     * regression must name itself.
     */
    function preview(container: HTMLElement): HTMLElement {
        const root = container.querySelector<HTMLElement>(
            '[data-testid="social-preview"]'
        );
        if (!root) throw new Error("no preview rendered");
        return root;
    }

    /**
     * Text of the chat bubble. The message is one `<p>` of title + link + body,
     * exactly as a messaging app renders it, so no fragment is its own element.
     */
    function bubbleText(container: HTMLElement): string {
        const bubble = preview(container).querySelector("p");
        if (!bubble) throw new Error("no chat bubble rendered");
        return bubble.textContent ?? "";
    }

    it("previews the bundled default when no tier is set", () => {
        const { container } = renderPanel(undefined, { lang: "fr" });
        // fr, because the identity language decides what an unset tier resolves to.
        expect(bubbleText(container)).toContain(
            "Découvrez ce produit incroyable !"
        );
    });

    it("previews the stored override instead of the default", () => {
        const { container } = renderPanel({
            default: { "sharing.text": "Stored body" },
        });
        expect(bubbleText(container)).toContain("Stored body");
        expect(bubbleText(container)).not.toContain(
            "Discover this amazing product!"
        );
    });

    it("tracks the field as it is typed", () => {
        const { container } = renderPanel();
        fireEvent.change(
            screen.getByLabelText("customize.sharing.fields.text.label"),
            { target: { value: "Live edit" } }
        );
        expect(bubbleText(container)).toContain("Live edit");
    });

    // The bundled title carries `{{productName}}`; the SDK interpolates it at
    // share time, so a raw token in the preview would be the merchant's only
    // sighting of it.
    it("shows no interpolation token", () => {
        const { container } = renderPanel({
            default: { "sharing.title": "{{productName}} — {Brand}" },
        });
        expect(container.textContent).not.toContain("{{productName}}");
        expect(container.textContent).not.toContain("{Brand}");
    });

    // The mock is inert: a live anchor would navigate the dashboard away and
    // discard unsaved copy, and it would bind a merchant-authored URL to `href`.
    it("renders the shared link without an anchor", () => {
        const { container } = renderPanel(undefined, {
            homepageLink: "https://nowa.example/shop",
        });
        expect(container.querySelector("a")).toBeNull();
        expect(bubbleText(container)).toContain("https://nowa.example/shop");
    });

    it("shows the host without its userinfo", () => {
        const { container } = renderPanel(undefined, {
            homepageLink: "https://a@evil.example@nowa.example/shop",
        });
        // Scoped to the host row: the bubble still prints the URL verbatim.
        const host = preview(container).querySelector(
            '[data-testid="link-card-host"]'
        );
        expect(host?.textContent).toBe("nowa.example");
    });

    it("renders the merchant logo in the link card", () => {
        const { container } = renderPanel(undefined, {
            logoUrl: "https://cdn.example.com/logo.png",
        });
        expect(preview(container).querySelector("img")).toHaveAttribute(
            "src",
            "https://cdn.example.com/logo.png"
        );
    });

    // A merchant with no logo must still get a card, not a gap.
    it("drops the image band but keeps the title and host rows", () => {
        const { container } = renderPanel(
            { default: { "sharing.title": "Card title" } },
            { homepageLink: "https://nowa.example/shop" }
        );
        const root = preview(container);
        expect(root.querySelector("img")).toBeNull();
        expect(
            root.querySelector('[data-testid="link-card-host"]')?.textContent
        ).toBe("nowa.example");
        expect(
            root.querySelector('[data-testid="link-card-title"]')?.textContent
        ).toBe("Card title");
    });

    // The preview is decorative. Focusable chrome inside it would land between
    // the language tabs and the wording inputs in the panel's tab order.
    it("adds no tab stop and stays out of the a11y tree", () => {
        const { container } = renderPanel();
        const root = preview(container);
        expect(root).toHaveAttribute("aria-hidden", "true");
        expect(
            root.querySelectorAll(
                "a, button, input, select, textarea, iframe, summary, [tabindex], [contenteditable]"
            )
        ).toHaveLength(0);
    });
});
