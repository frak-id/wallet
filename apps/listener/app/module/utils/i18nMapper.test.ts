import { beforeEach, describe, expect, it, vi } from "vitest";
import { mapI18nConfig, translationKeyPathToObject } from "./i18nMapper";

describe("translationKeyPathToObject", () => {
    it("should convert flat object with dot notation to nested object", () => {
        const input = {
            "key1.text": "value1",
            "key1.title": "value2",
            "key2.text": "value3",
        };

        const result = translationKeyPathToObject(input);

        expect(result).toEqual({
            key1: {
                text: "value1",
                title: "value2",
            },
            key2: {
                text: "value3",
            },
        });
    });

    it("should handle single-level keys", () => {
        const input = {
            key1: "value1",
            key2: "value2",
        };

        const result = translationKeyPathToObject(input);

        expect(result).toEqual({
            key1: "value1",
            key2: "value2",
        });
    });

    it("should handle deeply nested keys", () => {
        const input = {
            "level1.level2.level3.level4": "deep value",
        };

        const result = translationKeyPathToObject(input);

        expect(result).toEqual({
            level1: {
                level2: {
                    level3: {
                        level4: "deep value",
                    },
                },
            },
        });
    });

    it("should handle empty object", () => {
        const result = translationKeyPathToObject({});

        expect(result).toEqual({});
    });

    it("should merge keys with same prefix", () => {
        const input = {
            "user.name": "John",
            "user.email": "john@example.com",
            "user.profile.age": "30",
            "user.profile.city": "Paris",
        };

        const result = translationKeyPathToObject(input);

        expect(result).toEqual({
            user: {
                name: "John",
                email: "john@example.com",
                profile: {
                    age: "30",
                    city: "Paris",
                },
            },
        });
    });

    it("should handle mixed levels of nesting", () => {
        const input = {
            "app.title": "My App",
            "app.header.logo": "logo.png",
            "app.header.nav.home": "Home",
            "app.header.nav.about": "About",
            footer: "Footer text",
        };

        const result = translationKeyPathToObject(input);

        expect(result).toEqual({
            app: {
                title: "My App",
                header: {
                    logo: "logo.png",
                    nav: {
                        home: "Home",
                        about: "About",
                    },
                },
            },
            footer: "Footer text",
        });
    });

    it("should preserve non-string values", () => {
        const input = {
            "config.count": 42,
            "config.enabled": true,
            "config.items": ["a", "b", "c"],
        };

        const result = translationKeyPathToObject(input);

        expect(result).toEqual({
            config: {
                count: 42,
                enabled: true,
                items: ["a", "b", "c"],
            },
        });
    });

    it("should handle keys with special characters", () => {
        const input = {
            "menu.file_new": "New File",
            "menu.file-open": "Open File",
        };

        const result = translationKeyPathToObject(input);

        expect(result).toEqual({
            menu: {
                file_new: "New File",
                "file-open": "Open File",
            },
        });
    });

    it("should handle keys at different nesting levels", () => {
        const input = {
            "key.subkey.item1": "first",
            "key.subkey.item2": "second",
        };

        const result = translationKeyPathToObject(input);

        expect(result).toEqual({
            key: {
                subkey: {
                    item1: "first",
                    item2: "second",
                },
            },
        });
    });

    it("should handle values with multiple dots in key path", () => {
        const input = {
            "a.b.c.d.e.f": "value",
        };

        const result = translationKeyPathToObject(input);

        expect(result).toEqual({
            a: {
                b: {
                    c: {
                        d: {
                            e: {
                                f: "value",
                            },
                        },
                    },
                },
            },
        });
    });

    it("should be deterministic", () => {
        const input = {
            "key1.text": "value1",
            "key2.text": "value2",
        };

        const result1 = translationKeyPathToObject(input);
        const result2 = translationKeyPathToObject(input);

        expect(result1).toEqual(result2);
    });
});

describe("mapI18nConfig", () => {
    let mockI18n: any;

    beforeEach(() => {
        mockI18n = {
            language: "en",
            languages: ["en", "fr", "de"],
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

        const config = "https://example.com/translations.json" as any;

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

        const config = "https://example.com/broken.json" as any;

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
        } as any;

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

        const config = "https://example.com/invalid.json" as any;

        await mapI18nConfig(config, mockI18n);

        expect(consoleSpy).toHaveBeenCalled();
        consoleSpy.mockRestore();
    });
});
