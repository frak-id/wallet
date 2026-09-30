import type { SdkConfig } from "@frak-labs/backend-elysia/domain/merchant";
import { componentDefaults } from "@frak-labs/components/i18n/defaults";
import { replaceVariables } from "@frak-labs/ui-preview";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
    act,
    fireEvent,
    render,
    screen,
    waitFor,
    within,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("react-i18next", () => ({
    useTranslation: () => ({ t: (key: string) => key }),
}));

const editSdkConfig = vi.fn().mockResolvedValue(undefined);
vi.mock("@/module/merchant/hook/useMerchantUpdate", () => ({
    useMerchantUpdate: () => ({ mutateAsync: editSdkConfig, isSuccess: false }),
}));

const upload = vi.fn();
vi.mock("@/module/merchant/hook/useMediaUpload", () => ({
    useMediaUpload: () => ({
        mutate: upload,
        isPending: false,
        error: null,
        isSuccess: false,
        reset: vi.fn(),
    }),
    useMediaList: () => ({ data: [] }),
}));

import { merchantSdkConfigQueryKey } from "@/module/merchant/queries/queryKeys";
import { CustomizeSaveProvider } from "../saveRegistry";
import { AmbassadorPagePanel } from "./AmbassadorPagePanel";
import { AMBASSADOR_FIELD_GROUPS } from "./ambassadorForm";
import {
    AMBASSADOR_TONE_PRESET_FIELDS,
    AMBASSADOR_TONE_PRESETS,
} from "./presets";
import { SECTION_KEYS } from "./sections";

const EXPLORER_HERO = "https://cdn.example.com/explorer.jpg";

function queryClientWith(sdkConfig: SdkConfig) {
    const client = new QueryClient();
    client.setQueryData(merchantSdkConfigQueryKey("merchant-1", false), {
        sdkConfig,
    });
    return client;
}

function renderPanel(sdkConfig: SdkConfig, shopName = "My Store") {
    const sections = new Map<string, () => Promise<void>>();
    const view = render(
        <QueryClientProvider client={queryClientWith(sdkConfig)}>
            <CustomizeSaveProvider
                value={{
                    registerSection: (key, submit) => {
                        sections.set(key, submit);
                        return () => sections.delete(key);
                    },
                    onDirtyChange: () => {},
                }}
            >
                <AmbassadorPagePanel
                    merchantId="merchant-1"
                    sdkConfig={sdkConfig}
                    shopName={shopName}
                    explorerHeroImageUrl={EXPLORER_HERO}
                />
            </CustomizeSaveProvider>
        </QueryClientProvider>
    );
    const save = async () => {
        const submit = sections.get(SECTION_KEYS.ambassador);
        if (!submit) throw new Error("ambassador section never registered");
        await act(() => submit());
        return editSdkConfig.mock.calls[0]?.[0].components;
    };
    return { ...view, save };
}

function openAdvanced() {
    fireEvent.click(
        screen.getByRole("button", { name: "customize.components.advanced" })
    );
}

function pickTone(key: string) {
    fireEvent.click(
        screen.getByRole("radio", {
            name: new RegExp(`customize\\.ambassador\\.tonePresets\\.${key}`),
        })
    );
}

function selectTab(label: "English" | "Français") {
    fireEvent.mouseDown(screen.getByText(label));
    fireEvent.click(screen.getByText(label));
}

describe("AmbassadorPagePanel", () => {
    beforeEach(() => vi.clearAllMocks());

    it("saves the ambassador entry and keeps the other stored components", async () => {
        const { save } = renderPanel({
            components: { banner: { referralCta: "Got it" } },
        });

        openAdvanced();
        fireEvent.change(
            screen.getByLabelText("customize.ambassador.fields.heroTitle"),
            { target: { value: "Join {BRAND}" } }
        );
        const components = await save();

        expect(components).toEqual({
            banner: { referralCta: "Got it" },
            ambassador: { heroTitle: "Join {BRAND}" },
        });
    });

    it("previews the Explorer image by default and nothing once no photo is chosen", () => {
        const { container } = renderPanel({});
        expect(
            [...container.querySelectorAll("img")].some(
                (img) => img.getAttribute("src") === EXPLORER_HERO
            )
        ).toBe(true);

        fireEvent.mouseDown(
            screen.getByText("customize.ambassador.photo.none")
        );
        fireEvent.click(screen.getByText("customize.ambassador.photo.none"));
        expect(
            [...container.querySelectorAll("img")].some(
                (img) => img.getAttribute("src") === EXPLORER_HERO
            )
        ).toBe(false);
    });

    it("shows the typed FAQ answer in the phone before saving", () => {
        const view = renderPanel({});
        openAdvanced();
        const answer = screen.getByLabelText(
            "customize.ambassador.fields.faq2Answer"
        );
        fireEvent.change(answer, { target: { value: "Under three days" } });
        fireEvent.focus(answer);

        const phone = within(view.getByTestId("ambassador-phone-preview"));
        expect(phone.getByText("Under three days")).toBeInTheDocument();
    });

    it("shows the default-tier headline on the English tab with English built-in copy for untouched texts", () => {
        const view = renderPanel({ lang: "fr" });
        openAdvanced();
        fireEvent.change(
            screen.getByLabelText("customize.ambassador.fields.heroTitle"),
            { target: { value: "Join {BRAND}" } }
        );
        const phone = within(view.getByTestId("ambassador-phone-preview"));
        // getByText compares the raw matcher against collapsed node text, so collapse first.
        const fill = (text: string) =>
            replaceVariables(text, "eur", "My Store").replace(/\s+/g, " ");
        const frLede = fill(componentDefaults.fr.ambassador.heroLedeReward);
        const enLede = fill(componentDefaults.en.ambassador.heroLedeReward);
        expect(phone.getByText(frLede)).toBeInTheDocument();

        selectTab("English");
        expect(phone.getByText("Join My Store")).toBeInTheDocument();
        expect(phone.getByText(enLede)).toBeInTheDocument();
        expect(phone.queryByText(frLede)).not.toBeInTheDocument();
    });

    it("opens question 4 and highlights its answer when the answer field is focused", () => {
        const view = renderPanel({});
        openAdvanced();
        fireEvent.focus(
            screen.getByLabelText("customize.ambassador.fields.faq4Answer")
        );

        const phone = within(view.getByTestId("ambassador-phone-preview"));
        const { faq4Answer, faq1Answer } = componentDefaults.en.ambassador;
        expect(phone.getByText(faq4Answer)).toHaveAttribute(
            "data-highlighted",
            "true"
        );
        expect(phone.queryByText(faq1Answer)).not.toBeInTheDocument();
    });

    it("highlights the matching text in the phone for every editable field", () => {
        const view = renderPanel({});
        openAdvanced();
        const phone = view.getByTestId("ambassador-phone-preview");
        const fields = Object.values(AMBASSADOR_FIELD_GROUPS).flat();

        for (const field of fields) {
            fireEvent.focus(
                screen.getByLabelText(`customize.ambassador.fields.${field}`)
            );
            expect(
                phone.querySelector(`[data-slot="${field}"]`),
                field
            ).toHaveAttribute("data-highlighted", "true");
        }
    });

    it("highlights the hero when the photo choice is focused", () => {
        const view = renderPanel({});
        fireEvent.focus(screen.getByText("customize.ambassador.photo.none"));

        const phone = view.getByTestId("ambassador-phone-preview");
        expect(phone.querySelector('[data-slot="hero"]')).toHaveAttribute(
            "data-highlighted",
            "true"
        );
    });

    it("previews unsaved headline edits with the brand filled in", () => {
        renderPanel({}, "Nowa");

        openAdvanced();
        fireEvent.change(
            screen.getByLabelText("customize.ambassador.fields.heroTitle"),
            { target: { value: "Join {BRAND}" } }
        );

        expect(screen.getAllByText("Join Nowa")).toHaveLength(2);
    });

    it("previews the typed image once another image is chosen", () => {
        const { container, getByTestId } = renderPanel({});
        fireEvent.mouseDown(
            screen.getByText("customize.ambassador.photo.custom")
        );
        fireEvent.click(screen.getByText("customize.ambassador.photo.custom"));
        fireEvent.change(screen.getByPlaceholderText("https://..."), {
            target: { value: "https://cdn.example.com/mine.jpg" },
        });
        expect(container.querySelector("img")).toHaveAttribute(
            "src",
            "https://cdn.example.com/mine.jpg"
        );
        expect(
            getByTestId("ambassador-phone-preview").querySelector(
                'img[src="https://cdn.example.com/mine.jpg"]'
            )
        ).not.toBeNull();
    });

    it("uploads a new photo under its own key, never over the Explorer image", async () => {
        const { container } = renderPanel({});
        fireEvent.mouseDown(
            screen.getByText("customize.ambassador.photo.custom")
        );
        fireEvent.click(screen.getByText("customize.ambassador.photo.custom"));
        const input = container.querySelector('input[type="file"]');
        if (!input) throw new Error("no file input");
        fireEvent.change(input, {
            target: {
                files: [new File(["x"], "mine.png", { type: "image/png" })],
            },
        });
        await waitFor(() =>
            expect(upload).toHaveBeenCalledWith(
                expect.objectContaining({ type: "hero-extra" }),
                expect.anything()
            )
        );
    });

    it("edits the long texts in a multi-line field", () => {
        renderPanel({});
        openAdvanced();
        expect(
            screen.getByLabelText("customize.ambassador.fields.faq1Answer")
                .tagName
        ).toBe("TEXTAREA");
    });

    it("opens the whole page in a sheet showing the unsaved headline", async () => {
        const view = renderPanel({}, "Nowa");
        openAdvanced();
        fireEvent.change(
            screen.getByLabelText("customize.ambassador.fields.heroTitle"),
            { target: { value: "Join {BRAND}" } }
        );
        fireEvent.click(
            screen.getByRole("button", {
                name: "customize.ambassador.fullPreview",
            })
        );

        const dialog = await view.findByRole("dialog");
        const phone = within(dialog).getByTestId("ambassador-phone-preview");
        expect(within(phone).getByText("Join Nowa")).toBeInTheDocument();
    });

    it("opens the sheet with faq 4 open and highlighted after focusing its answer", async () => {
        const view = renderPanel({});
        openAdvanced();
        const answer = screen.getByLabelText(
            "customize.ambassador.fields.faq4Answer"
        );
        fireEvent.change(answer, { target: { value: "Four-ish" } });
        fireEvent.focus(answer);

        fireEvent.click(
            screen.getByRole("button", {
                name: "customize.ambassador.fullPreview",
            })
        );

        const dialog = await view.findByRole("dialog");
        const phone = within(dialog).getByTestId("ambassador-phone-preview");
        expect(within(phone).getByText("Four-ish")).toHaveAttribute(
            "data-highlighted",
            "true"
        );
    });

    it("keeps every text field, the FAQ included, under the advanced settings", () => {
        renderPanel({});
        const fields = Object.values(AMBASSADOR_FIELD_GROUPS).flat();
        for (const field of fields) {
            expect(
                screen.queryByLabelText(`customize.ambassador.fields.${field}`)
            ).not.toBeInTheDocument();
        }

        openAdvanced();

        for (const field of fields) {
            expect(
                screen.getByLabelText(`customize.ambassador.fields.${field}`)
            ).toBeInTheDocument();
        }
    });

    it("offers one tile per tone, with its hero title in the brand's name", () => {
        renderPanel({}, "Nowa");
        expect(screen.getAllByRole("radio")).toHaveLength(
            AMBASSADOR_TONE_PRESETS.length
        );
        expect(
            screen.getByText("Recommend Nowa, simply and safely")
        ).toBeInTheDocument();
    });

    it("selects Classic when no ambassador text is saved", () => {
        renderPanel({});
        expect(
            screen.getByRole("radio", { checked: true })
        ).toHaveAccessibleName(/customize\.ambassador\.tonePresets\.classic/);
    });

    it("replaces a stored all-languages text and shows the picked tone in the phone", async () => {
        const view = renderPanel({
            components: { ambassador: { heroTitle: "Old title" } },
        });
        pickTone("trust");

        const phone = within(view.getByTestId("ambassador-phone-preview"));
        expect(
            phone.getByText("Recommend My Store, simply and safely")
        ).toBeInTheDocument();
        const components = await view.save();
        const trust = AMBASSADOR_TONE_PRESETS[2];
        expect(components.ambassador.heroTitle).toEqual({
            en: trust.en.heroTitle,
            fr: trust.fr.heroTitle,
        });
    });

    it("previews a French store's picked tone in French, in the phone and on the tile", () => {
        const view = renderPanel({ lang: "fr" });
        pickTone("trust");

        const trust = AMBASSADOR_TONE_PRESETS[2];
        const inShop = (text: string) => text.replace(/\{BRAND\}/g, "My Store");
        const phone = within(view.getByTestId("ambassador-phone-preview"));
        expect(phone.getByText(inShop(trust.fr.heroTitle))).toBeInTheDocument();
        expect(
            phone.queryByText(inShop(trust.en.heroTitle))
        ).not.toBeInTheDocument();

        const tiles = within(screen.getByRole("radiogroup"));
        expect(tiles.getByText(inShop(trust.fr.heroTitle))).toBeInTheDocument();
        expect(
            tiles.queryByText(inShop(trust.en.heroTitle))
        ).not.toBeInTheDocument();
    });

    it("stores a picked tone in both languages and leaves the FAQ alone", async () => {
        const faq = {
            faq1Question: "Who runs it?",
            faq5Answer: { en: "We do.", fr: "Nous." },
        };
        const view = renderPanel({ components: { ambassador: faq } });
        selectTab("English");
        pickTone("earnings");

        const earnings = AMBASSADOR_TONE_PRESETS[1];
        expect(await view.save()).toEqual({
            ambassador: {
                ...Object.fromEntries(
                    AMBASSADOR_TONE_PRESET_FIELDS.map((field) => [
                        field,
                        { en: earnings.en[field], fr: earnings.fr[field] },
                    ])
                ),
                ...faq,
            },
        });
    });

    it("clears a picked tone back to the built-in copy when Classic is picked", async () => {
        const faq = { faq1Question: "Who runs it?" };
        const view = renderPanel({ components: { ambassador: faq } });
        pickTone("trust");
        pickTone("classic");

        expect(await view.save()).toEqual({ ambassador: faq });
    });

    it("clears a stored all-languages text when Classic is picked", async () => {
        const faq = { faq1Question: "Who runs it?" };
        const view = renderPanel({
            components: { ambassador: { ...faq, heroTitle: "Old title" } },
        });
        pickTone("classic");

        expect(await view.save()).toEqual({ ambassador: faq });
    });

    it("selects no tile once a picked tone's text is edited", () => {
        renderPanel({});
        pickTone("casual");
        expect(
            screen.getByRole("radio", { checked: true })
        ).toBeInTheDocument();

        openAdvanced();
        fireEvent.change(
            screen.getByLabelText(
                "customize.ambassador.fields.referralCtaLabel"
            ),
            { target: { value: "Go" } }
        );

        expect(
            screen.queryByRole("radio", { checked: true })
        ).not.toBeInTheDocument();
    });

    it("selects no tile once a picked tone's French text is edited", () => {
        renderPanel({});
        pickTone("trust");
        selectTab("Français");
        openAdvanced();
        fireEvent.change(
            screen.getByLabelText("customize.ambassador.fields.heroLede"),
            { target: { value: "Autre chose" } }
        );

        expect(
            screen.queryByRole("radio", { checked: true })
        ).not.toBeInTheDocument();
    });

    it("keeps stored FAQ text as ordinary values", async () => {
        const faq = { faq1Answer: "Old preset answer" };
        const view = renderPanel({ components: { ambassador: faq } });
        openAdvanced();

        expect(
            screen.getByLabelText("customize.ambassador.fields.faq1Answer")
        ).toHaveValue("Old preset answer");
        expect(await view.save()).toEqual({ ambassador: faq });
    });

    it("stores an all-languages edit in place of the field's English and French text", async () => {
        const view = renderPanel({
            components: {
                ambassador: { heroTitle: { en: "Hello", fr: "Bonjour" } },
            },
        });
        openAdvanced();

        fireEvent.change(
            screen.getByLabelText("customize.ambassador.fields.heroTitle"),
            { target: { value: "Hi all" } }
        );
        fireEvent.change(
            screen.getByLabelText("customize.ambassador.fields.faq2Answer"),
            { target: { value: "Paid monthly." } }
        );

        expect(await view.save()).toEqual({
            ambassador: { heroTitle: "Hi all", faq2Answer: "Paid monthly." },
        });
    });
});
