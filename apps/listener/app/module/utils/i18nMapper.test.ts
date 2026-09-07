import { beforeEach, describe, expect, it, vi } from "vitest";
import { mapI18nConfig } from "./i18nMapper";

describe("mapI18nConfig", () => {
    let mockI18n: any;

    beforeEach(() => {
        mockI18n = {
            language: "en",
            languages: ["en", "fr", "de"],
            options: { supportedLngs: ["en", "fr", "de"] },
            addResourceBundle: vi.fn(),
        };
        vi.stubGlobal("fetch", vi.fn());
    });

    it("should handle localized config with string URL", async () => {
        const mockResponse = {
            "app.title": "My App",
            "app.description": "Description",
        };

        vi.mocked(global.fetch).mockResolvedValue({
            json: () => Promise.resolve(mockResponse),
        } as Response);

        const config =
            "https://example.com/translations.json" as unknown as Parameters<
                typeof mapI18nConfig
            >[0];

        await mapI18nConfig(config, mockI18n);

        expect(mockI18n.addResourceBundle).toHaveBeenCalledWith(
            "en",
            "customized",
            expect.objectContaining({
                app: {
                    title: "My App",
                    description: "Description",
                },
            }),
            true,
            true
        );
    });

    it("should handle localized config with direct object", async () => {
        const config = {
            "app.title": "My App",
            "app.subtitle": "Best App",
        };

        await mapI18nConfig(config, mockI18n);

        expect(mockI18n.addResourceBundle).toHaveBeenCalledWith(
            "en",
            "customized",
            expect.objectContaining({
                app: {
                    title: "My App",
                    subtitle: "Best App",
                },
            }),
            true,
            true
        );
    });

    it("should handle multi-language config", async () => {
        const config = {
            en: {
                "app.title": "My App",
            },
            fr: {
                "app.title": "Mon Application",
            },
            de: {
                "app.title": "Meine App",
            },
        };

        await mapI18nConfig(config, mockI18n);

        expect(mockI18n.addResourceBundle).toHaveBeenCalledTimes(3);
        expect(mockI18n.addResourceBundle).toHaveBeenCalledWith(
            "en",
            "customized",
            expect.objectContaining({ app: { title: "My App" } }),
            true,
            true
        );
        expect(mockI18n.addResourceBundle).toHaveBeenCalledWith(
            "fr",
            "customized",
            expect.objectContaining({ app: { title: "Mon Application" } }),
            true,
            true
        );
        expect(mockI18n.addResourceBundle).toHaveBeenCalledWith(
            "de",
            "customized",
            expect.objectContaining({ app: { title: "Meine App" } }),
            true,
            true
        );
    });

    it("should handle multi-language config with URL strings", async () => {
        const mockEnResponse = { "app.title": "English App" };
        const mockFrResponse = { "app.title": "French App" };

        vi.mocked(global.fetch).mockImplementation((url) => {
            if (url === "https://example.com/en.json") {
                return Promise.resolve({
                    json: () => Promise.resolve(mockEnResponse),
                } as Response);
            }
            if (url === "https://example.com/fr.json") {
                return Promise.resolve({
                    json: () => Promise.resolve(mockFrResponse),
                } as Response);
            }
            return Promise.reject(new Error("Unknown URL"));
        });

        const config = {
            en: "https://example.com/en.json",
            fr: "https://example.com/fr.json",
        };

        await mapI18nConfig(config, mockI18n);

        expect(mockI18n.addResourceBundle).toHaveBeenCalledTimes(2);
        expect(mockI18n.addResourceBundle).toHaveBeenCalledWith(
            "en",
            "customized",
            expect.objectContaining({ app: { title: "English App" } }),
            true,
            true
        );
        expect(mockI18n.addResourceBundle).toHaveBeenCalledWith(
            "fr",
            "customized",
            expect.objectContaining({ app: { title: "French App" } }),
            true,
            true
        );
    });

    it("should handle fetch errors gracefully", async () => {
        vi.mocked(global.fetch).mockRejectedValue(new Error("Network error"));
        const consoleSpy = vi
            .spyOn(console, "warn")
            .mockImplementation(() => {});

        const config =
            "https://example.com/broken.json" as unknown as Parameters<
                typeof mapI18nConfig
            >[0];

        await mapI18nConfig(config, mockI18n);

        expect(consoleSpy).toHaveBeenCalledWith(
            "Failed to load custom translation file",
            expect.any(Error),
            { value: config }
        );

        consoleSpy.mockRestore();
    });

    it("should handle empty object config", async () => {
        const config = {};

        // Empty object doesn't meet localized config criteria (Object.keys.length > 0)
        // So it's treated as multi-language config with no languages
        // Should not throw and not add any resources
        await mapI18nConfig(config, mockI18n);

        expect(mockI18n.addResourceBundle).not.toHaveBeenCalled();
    });

    it("should detect localized config when keys don't match language codes", async () => {
        mockI18n.languages = ["en", "fr"];

        const config = {
            "app.title": "Title",
            "app.text": "Text",
        };

        await mapI18nConfig(config, mockI18n);

        // Should be treated as localized config (single language)
        expect(mockI18n.addResourceBundle).toHaveBeenCalledWith(
            "en",
            "customized",
            expect.any(Object),
            true,
            true
        );
    });

    it("should detect multi-language config when keys match language codes", async () => {
        mockI18n.languages = ["en", "fr"];

        const config = {
            en: { "app.title": "English" },
            fr: { "app.title": "Français" },
        };

        await mapI18nConfig(config, mockI18n);

        // Should be treated as multi-language config
        expect(mockI18n.addResourceBundle).toHaveBeenCalledTimes(2);
    });

    it("should handle mixed object and string values in multi-language config", async () => {
        vi.mocked(global.fetch).mockResolvedValue({
            json: () => Promise.resolve({ "key.text": "Fetched" }),
        } as Response);

        const config = {
            en: { "app.title": "Direct" },
            fr: "https://example.com/fr.json" as any,
        } as unknown as Parameters<typeof mapI18nConfig>[0];

        await mapI18nConfig(config, mockI18n);

        expect(mockI18n.addResourceBundle).toHaveBeenCalledTimes(2);
    });

    it("should handle JSON parse errors", async () => {
        vi.mocked(global.fetch).mockResolvedValue({
            json: () => Promise.reject(new Error("Invalid JSON")),
        } as Response);

        const consoleSpy = vi
            .spyOn(console, "warn")
            .mockImplementation(() => {});

        const config =
            "https://example.com/invalid.json" as unknown as Parameters<
                typeof mapI18nConfig
            >[0];

        await mapI18nConfig(config, mockI18n);

        expect(consoleSpy).toHaveBeenCalled();
        consoleSpy.mockRestore();
    });

    // Regression: cloneInstance() returns synchronously but populates
    // `languages` only after async init completes. Detection must still
    // work via supportedLngs / language fallbacks during that window.
    describe("when i18n.languages is not yet populated", () => {
        it("should fall back to options.supportedLngs to detect language codes", async () => {
            mockI18n.languages = undefined;
            mockI18n.options = { supportedLngs: ["en", "fr", "de"] };

            const config = {
                en: { "app.title": "English" },
                fr: { "app.title": "Français" },
            };

            await mapI18nConfig(config, mockI18n);

            expect(mockI18n.addResourceBundle).toHaveBeenCalledTimes(2);
        });

        it("should fall back to options.supportedLngs to detect localized config", async () => {
            mockI18n.languages = undefined;
            mockI18n.options = { supportedLngs: ["en", "fr", "de"] };

            const config = {
                "app.title": "Title",
                "app.text": "Text",
            };

            await mapI18nConfig(config, mockI18n);

            expect(mockI18n.addResourceBundle).toHaveBeenCalledWith(
                "en",
                "customized",
                expect.any(Object),
                true,
                true
            );
        });

        it("should fall back to language when supportedLngs is missing", async () => {
            mockI18n.languages = undefined;
            mockI18n.options = {};

            const config = {
                en: { "app.title": "English" },
            } as unknown as Parameters<typeof mapI18nConfig>[0];

            await mapI18nConfig(config, mockI18n);

            expect(mockI18n.addResourceBundle).toHaveBeenCalledTimes(1);
            expect(mockI18n.addResourceBundle).toHaveBeenCalledWith(
                "en",
                "customized",
                expect.objectContaining({ app: { title: "English" } }),
                true,
                true
            );
        });

        it("should not throw when languages, supportedLngs and language are all missing", async () => {
            mockI18n.languages = undefined;
            mockI18n.language = undefined;
            mockI18n.options = {};

            const config = {
                "app.title": "Title",
            };

            await expect(
                mapI18nConfig(config, mockI18n)
            ).resolves.not.toThrow();
        });
    });
});
