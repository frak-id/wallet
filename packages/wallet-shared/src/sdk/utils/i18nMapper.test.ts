import { describe, expect, it } from "vitest";
import { translationKeyPathToObject } from "./i18nMapper";

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
