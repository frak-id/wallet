import { deflateRawSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import {
    buildItem,
    compileSdkFor,
    type Facts,
    highestSameShape,
    parseCatalog,
    parseKts,
    parseSwiftPackage,
    parseWrapper,
} from "./dependency/collect-native";
import {
    aarProperties,
    parseMavenVersions,
    parseProperties,
    readZipEntry,
} from "./dependency/registry";
import { pathTrapFor, trapFor } from "./dependency/traps";

const at = (file: string, line: number) => ({ file, line });

function buildZip(entries: { name: string; data: string; stored?: boolean }[]) {
    const locals: Buffer[] = [];
    const centrals: Buffer[] = [];
    let offset = 0;
    for (const { name, data, stored } of entries) {
        const raw = Buffer.from(data);
        const body = stored ? raw : deflateRawSync(raw);
        const label = Buffer.from(name);
        const local = Buffer.alloc(30);
        local.writeUInt32LE(0x04034b50, 0);
        local.writeUInt16LE(stored ? 0 : 8, 8);
        local.writeUInt32LE(body.length, 18);
        local.writeUInt32LE(raw.length, 22);
        local.writeUInt16LE(label.length, 26);
        const central = Buffer.alloc(46);
        central.writeUInt32LE(0x02014b50, 0);
        central.writeUInt16LE(stored ? 0 : 8, 10);
        central.writeUInt32LE(body.length, 20);
        central.writeUInt32LE(raw.length, 24);
        central.writeUInt16LE(label.length, 28);
        central.writeUInt32LE(offset, 42);
        locals.push(local, label, body);
        centrals.push(central, label);
        offset += local.length + label.length + body.length;
    }
    const directory = Buffer.concat(centrals);
    const end = Buffer.alloc(22);
    end.writeUInt32LE(0x06054b50, 0);
    end.writeUInt16LE(entries.length, 10);
    end.writeUInt32LE(directory.length, 12);
    end.writeUInt32LE(offset, 16);
    return Buffer.concat([...locals, directory, end]);
}

describe("parseKts", () => {
    const source = [
        "plugins {",
        '    id("com.android.application") version "9.1.1" apply false',
        '    id("org.jetbrains.kotlin.android")',
        "}",
        "dependencies {",
        '    // implementation("com.example:commented:1.0.0")',
        '    implementation("androidx.core:core-ktx:1.18.0")',
        '    implementation(platform("androidx.compose:compose-bom:2026.06.01"))',
        '    implementation("androidx.compose.ui:ui")',
        '    implementation("id.frak.sdk:core:1.0.0")',
        '    testImplementation("junit:junit:$junitVersion")',
        "}",
    ].join("\n");

    it("reads coordinates and plugin versions with 1-based lines", () => {
        expect(parseKts("a/build.gradle.kts", source)).toEqual([
            {
                kind: "gradle-plugin",
                id: "com.android.application",
                version: "9.1.1",
                location: at("a/build.gradle.kts", 2),
            },
            {
                kind: "maven",
                group: "androidx.core",
                artifact: "core-ktx",
                version: "1.18.0",
                location: at("a/build.gradle.kts", 7),
            },
            {
                kind: "maven",
                group: "androidx.compose",
                artifact: "compose-bom",
                version: "2026.06.01",
                location: at("a/build.gradle.kts", 8),
            },
        ]);
    });
});

describe("parseCatalog", () => {
    const source = [
        "[versions]",
        "# a comment",
        'agp = "9.1.1"',
        'json = "20260719"',
        "",
        "[libraries]",
        'core = { module = "androidx.core:core", version.ref = "agp" }',
        'split = { group = "org.json", name = "json", version.ref = "json" }',
        'literal = { module = "junit:junit", version = "4.13.2" }',
        'bom-managed = { module = "androidx.compose.ui:ui" }',
        'own = { module = "id.frak.sdk:core", version = "1.0.0" }',
        "",
        "[plugins]",
        'library = { id = "com.android.library", version.ref = "agp" }',
    ].join("\n");
    const pins = parseCatalog("gradle/libs.versions.toml", source);

    it("points a version.ref at the [versions] line", () => {
        expect(pins).toContainEqual({
            kind: "maven",
            group: "androidx.core",
            artifact: "core",
            version: "9.1.1",
            location: at("gradle/libs.versions.toml", 3),
        });
        expect(pins).toContainEqual({
            kind: "maven",
            group: "org.json",
            artifact: "json",
            version: "20260719",
            location: at("gradle/libs.versions.toml", 4),
        });
    });

    it("keeps a literal version on the library line", () => {
        expect(pins).toContainEqual({
            kind: "maven",
            group: "junit",
            artifact: "junit",
            version: "4.13.2",
            location: at("gradle/libs.versions.toml", 9),
        });
    });

    it("reads plugins and skips unversioned and first-party entries", () => {
        expect(pins).toContainEqual({
            kind: "gradle-plugin",
            id: "com.android.library",
            version: "9.1.1",
            location: at("gradle/libs.versions.toml", 3),
        });
        expect(pins).toHaveLength(4);
    });
});

describe("parseWrapper", () => {
    it("reads the version out of distributionUrl", () => {
        const source = [
            "distributionBase=GRADLE_USER_HOME",
            "distributionUrl=https\\://services.gradle.org/distributions/gradle-9.5.0-bin.zip",
        ].join("\n");
        expect(parseWrapper("w.properties", source)).toEqual([
            {
                kind: "gradle-wrapper",
                version: "9.5.0",
                location: at("w.properties", 2),
            },
        ]);
    });
});

describe("parseSwiftPackage", () => {
    it("keeps remote packages and skips path packages", () => {
        const source = [
            "dependencies: [",
            '    .package(name: "Tauri", path: "../.tauri/tauri-api"),',
            '    .package(url: "https://github.com/firebase/firebase-ios-sdk", from: "13.1.1"),',
            '    .package(url: "https://github.com/o/r.git", exact: "1.2.3"),',
            "]",
        ].join("\n");
        expect(parseSwiftPackage("Package.swift", source)).toEqual([
            {
                kind: "swiftpm",
                slug: "firebase/firebase-ios-sdk",
                version: "13.1.1",
                location: at("Package.swift", 3),
            },
            {
                kind: "swiftpm",
                slug: "o/r",
                version: "1.2.3",
                location: at("Package.swift", 4),
            },
        ]);
    });
});

describe("highestSameShape", () => {
    it("never lets a pre-release beat a stable pin", () => {
        const versions = ["1.18.0", "1.19.0-alpha04", "1.19.0-rc01", "1.19.1"];
        expect(highestSameShape("1.18.0", versions)).toBe("1.19.1");
        expect(highestSameShape("1.18.0", ["1.18.0", "1.19.0-rc01"])).toBe(
            "1.18.0"
        );
    });

    it("compares numerically, not lexically", () => {
        expect(highestSameShape("1.0.0", ["1.0.9", "1.0.10"])).toBe("1.0.10");
    });

    it("handles date-shaped versions", () => {
        expect(highestSameShape("20260719", ["20260719", "20260814"])).toBe(
            "20260814"
        );
        expect(
            highestSameShape("2026.06.01", ["2026.06.01", "2026.09.00"])
        ).toBe("2026.09.00");
    });

    it("stays on the current suffix", () => {
        expect(highestSameShape("1.0.0-rc01", ["1.0.0-rc01", "2.0.0"])).toBe(
            "1.0.0-rc01"
        );
    });
});

describe("parseMavenVersions", () => {
    it("lists every <version> entry", () => {
        const xml =
            "<metadata><versioning><latest>2</latest><versions><version>1</version><version>2</version></versions></versioning></metadata>";
        expect(parseMavenVersions(xml)).toEqual(["1", "2"]);
    });
});

describe("aar-metadata.properties", () => {
    const path = "META-INF/com/android/build/gradle/aar-metadata.properties";
    const properties =
        "aarFormatVersion=1.0\nminCompileSdk=37\nminAndroidGradlePluginVersion=9.1.0\n";

    it("is read out of a deflated zip entry", () => {
        const zip = buildZip([
            { name: "classes.jar", data: "x" },
            { name: path, data: properties },
        ]);
        const entry = readZipEntry(zip, path);
        expect(parseProperties(entry?.toString() ?? "")).toMatchObject({
            minCompileSdk: "37",
            minAndroidGradlePluginVersion: "9.1.0",
        });
    });

    it("is read out of a stored entry", () => {
        const zip = buildZip([{ name: path, data: properties, stored: true }]);
        expect(readZipEntry(zip, path)?.toString()).toBe(properties);
    });

    it("is null when the entry is absent", () => {
        expect(readZipEntry(buildZip([{ name: "a", data: "b" }]), path)).toBe(
            null
        );
    });

    it("is empty for an AAR without metadata and null for a corrupt one", () => {
        const empty = buildZip([{ name: "classes.jar", data: "x" }]);
        expect(aarProperties(empty, "empty.aar")).toEqual({});
        const corrupt = buildZip([{ name: path, data: properties }]);
        corrupt.fill(0xff, 30 + path.length, 38 + path.length);
        expect(aarProperties(corrupt, "corrupt.aar")).toBe(null);
    });
});

describe("buildItem", () => {
    const pin = {
        kind: "maven" as const,
        group: "androidx.core",
        artifact: "core",
        version: "1.18.0",
        location: at("sdk/android/gradle/libs.versions.toml", 33),
    };
    const facts = (overrides: Partial<Facts>): Facts => ({
        group: { name: "androidx.core:core", version: "1.18.0", pins: [pin] },
        candidates: { versions: ["1.19.1"], source: "google", repo: "google" },
        latest: "1.19.1",
        others: [],
        aar: { minCompileSdk: "37" },
        lowestSdk: { sdk: 36, scope: "sdk/android" },
        ...overrides,
    });

    it("flags a latest that needs a higher compileSdk", () => {
        const item = buildItem(facts({}));
        expect(item.flags).toContain("floor-coupled");
        expect(item.note).toContain("needs compileSdk 37");
        expect(item.meta).toMatchObject({
            minCompileSdk: "37",
            compileSdk: "36",
        });
    });

    it("does not flag an equal or lower minCompileSdk", () => {
        for (const minCompileSdk of ["36", "35"]) {
            const item = buildItem(facts({ aar: { minCompileSdk } }));
            expect(item.flags).not.toContain("floor-coupled");
        }
    });

    it("says so when the AAR declares no minCompileSdk", () => {
        const item = buildItem(facts({ aar: {} }));
        expect(item.flags).not.toContain("floor-coupled");
        expect(item.note).toContain("declares no minCompileSdk");
    });

    it("stays silent without an AAR", () => {
        const item = buildItem(facts({ aar: null }));
        expect(item.flags).not.toContain("floor-coupled");
        expect(item.note).toBeUndefined();
    });

    it("suffixes the id when the name has other versions", () => {
        expect(buildItem(facts({})).id).toBe("native:androidx.core:core");
        expect(buildItem(facts({ others: ["1.13.1"] })).id).toBe(
            "native:androidx.core:core@1.18.0"
        );
    });

    it("notes that a suffixed pin is only compared within its suffix", () => {
        const group = { name: "x:y", version: "1.1.0-alpha05", pins: [pin] };
        const item = buildItem(
            facts({ group, latest: "1.1.0-alpha05", aar: null })
        );
        expect(item.note).toContain("carries a suffix");
    });
});

describe("compileSdkFor", () => {
    const sources = new Map([
        ["sdk/android/frak-sdk/build.gradle.kts", "plugins {}"],
        [
            "sdk/android/buildSrc/src/main/kotlin/frak-publish.gradle.kts",
            "android {\n    compileSdk = 36\n}",
        ],
        ["sdk/android/other/build.gradle.kts", "    compileSdk = 35"],
        ["app/build.gradle.kts", "    compileSdk = 37"],
    ]);
    const roots = ["sdk/android"];

    it("prefers the module's own value", () => {
        expect(compileSdkFor("app/build.gradle.kts", sources, roots)).toEqual({
            sdk: 37,
            scope: "app",
        });
    });

    it("takes the lowest value under the Gradle root otherwise", () => {
        const file = "sdk/android/gradle/libs.versions.toml";
        expect(compileSdkFor(file, sources, roots)).toEqual({
            sdk: 35,
            scope: "sdk/android",
        });
    });

    it("is null outside any root with no own value", () => {
        expect(
            compileSdkFor("elsewhere/build.gradle.kts", sources, roots)
        ).toBe(null);
    });
});

describe("traps", () => {
    it("pairs AGP and Kotlin", () => {
        expect(trapFor("com.android.tools.build:gradle").flags).toContain(
            "paired"
        );
        expect(trapFor("org.jetbrains.kotlin.plugin.compose").flags).toContain(
            "paired"
        );
        expect(trapFor("org.ow2.asm:asm-tree").flags).toContain("paired");
    });

    it("keys path traps on the location's file", () => {
        expect(
            pathTrapFor("apps/wallet/src-tauri/gen/android/build.gradle.kts")
        ).toContain("tauri android init");
        expect(pathTrapFor("sdk/android/gradle/libs.versions.toml")).toContain(
            "compileSdk"
        );
        expect(pathTrapFor("sdk/ios/Package.swift")).toBeNull();
    });
});
