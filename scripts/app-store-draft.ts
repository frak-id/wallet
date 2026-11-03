#!/usr/bin/env bun
/**
 * Drafts the App Store version for a build `altool` already uploaded: waits for
 * App Store Connect to process it, reuses or creates the editable iOS version,
 * attaches the build and writes What's New. Submitting for review stays a human click.
 */
import { appendFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { NOTE_LOCALES, NOTES_DIR, type Notes, readNotes } from "./store-notes";

const API = "https://api.appstoreconnect.apple.com";

// The states in which Apple still accepts a new build and new metadata.
export const EDITABLE_STATES = new Set([
    "PREPARE_FOR_SUBMISSION",
    "DEVELOPER_REJECTED",
    "REJECTED",
    "METADATA_REJECTED",
    "INVALID_BINARY",
]);

// Apple holds one of these, and no second version opens until it ships or is withdrawn.
export const HELD_STATES = new Set([
    "READY_FOR_REVIEW",
    "WAITING_FOR_REVIEW",
    "IN_REVIEW",
    "WAITING_FOR_EXPORT_COMPLIANCE",
    "ACCEPTED",
    "PENDING_APPLE_RELEASE",
    "PENDING_DEVELOPER_RELEASE",
    "PROCESSING_FOR_DISTRIBUTION",
]);

export type Credentials = {
    keyId: string;
    issuerId: string;
    privateKey: string;
};
export type Resource<A> = { id: string; type: string; attributes: A };
type Page<A> = { data: Resource<A>[] };
type One<A> = { data: Resource<A> };
export type VersionAttributes = {
    versionString: string;
    appVersionState?: string;
    appStoreState?: string;
};
type BuildAttributes = { version: string; processingState: string };
type LocalizationAttributes = { locale: string };

export type Client = <T>(
    method: string,
    path: string,
    body?: unknown
) => Promise<T>;
export type Wait = {
    pollMs: number;
    timeoutMs: number;
    sleep: (ms: number) => Promise<void>;
    log: (line: string) => void;
};

const sleep = (ms: number) =>
    new Promise<void>((resolve) => setTimeout(resolve, ms));

function base64url(bytes: Uint8Array | string): string {
    return Buffer.from(bytes).toString("base64url");
}

/** ES256 JWT for the App Store Connect API, valid 15 minutes (Apple caps it at 20). */
export async function signToken(
    credentials: Credentials,
    now = Date.now()
): Promise<string> {
    const der = Buffer.from(
        credentials.privateKey.replace(/-----[^-]+-----|\s/g, ""),
        "base64"
    );
    const key = await crypto.subtle.importKey(
        "pkcs8",
        der,
        { name: "ECDSA", namedCurve: "P-256" },
        false,
        ["sign"]
    );
    const iat = Math.floor(now / 1000);
    const header = base64url(
        JSON.stringify({ alg: "ES256", kid: credentials.keyId, typ: "JWT" })
    );
    const payload = base64url(
        JSON.stringify({
            iss: credentials.issuerId,
            iat,
            exp: iat + 15 * 60,
            aud: "appstoreconnect-v1",
        })
    );
    // WebCrypto emits raw r||s, which is exactly what JWS ES256 wants.
    const signature = await crypto.subtle.sign(
        { name: "ECDSA", hash: "SHA-256" },
        key,
        new TextEncoder().encode(`${header}.${payload}`)
    );
    return `${header}.${payload}.${base64url(new Uint8Array(signature))}`;
}

export function createClient(
    credentials: Credentials,
    fetchImpl: typeof fetch = fetch,
    retryMs = 10_000
): Client {
    const send = async (method: string, path: string, body?: unknown) =>
        fetchImpl(`${API}${path}`, {
            method,
            headers: {
                Authorization: `Bearer ${await signToken(credentials)}`,
                "Content-Type": "application/json",
            },
            body: body === undefined ? undefined : JSON.stringify(body),
        });
    return async <T>(method: string, path: string, body?: unknown) => {
        for (let attempt = 1; ; attempt++) {
            const response = await send(method, path, body);
            const text = await response.text();
            if (response.ok) return (text ? JSON.parse(text) : {}) as T;
            const transient = response.status === 429 || response.status >= 500;
            if (!transient || attempt === 3) {
                throw new Error(
                    `${method} ${path} → HTTP ${response.status}\n${text}`
                );
            }
            await sleep(retryMs * attempt);
        }
    };
}

function stateOf(version: Resource<VersionAttributes>): string {
    return (
        version.attributes.appVersionState ??
        version.attributes.appStoreState ??
        ""
    );
}

export type VersionPlan =
    | { action: "create" }
    | { action: "reuse"; id: string; rename: boolean };

export function planVersion(
    versions: Resource<VersionAttributes>[],
    versionString: string
): VersionPlan {
    const held = versions.find((v) => HELD_STATES.has(stateOf(v)));
    if (held) {
        throw new Error(
            `${held.attributes.versionString} is ${stateOf(held)} on the App Store: release or withdraw it, then re-run this job.`
        );
    }
    const editable = versions.find((v) => EDITABLE_STATES.has(stateOf(v)));
    if (!editable) return { action: "create" };
    return {
        action: "reuse",
        id: editable.id,
        rename: editable.attributes.versionString !== versionString,
    };
}

/** Exact locale, then same language, then English: `en-GB` and `fr-CA` read the closest file. */
export function notesFor(locale: string, notes: Notes): string {
    const language = locale.split("-")[0];
    const match =
        NOTE_LOCALES.find((l) => l === locale) ??
        NOTE_LOCALES.find((l) => l.split("-")[0] === language) ??
        "en-US";
    return notes[match];
}

async function findApp(client: Client, bundleId: string): Promise<string> {
    const query = new URLSearchParams({
        "filter[bundleId]": bundleId,
        "fields[apps]": "bundleId",
    });
    const { data } = await client<Page<{ bundleId: string }>>(
        "GET",
        `/v1/apps?${query}`
    );
    const app = data.find((a) => a.attributes.bundleId === bundleId);
    if (!app) throw new Error(`No App Store Connect app for ${bundleId}`);
    return app.id;
}

export async function waitForBuild(
    client: Client,
    input: { appId: string; version: string; build: string },
    wait: Wait
): Promise<string> {
    const query = new URLSearchParams({
        "filter[app]": input.appId,
        "filter[version]": input.build,
        "filter[preReleaseVersion.version]": input.version,
        "filter[preReleaseVersion.platform]": "IOS",
        "fields[builds]": "version,processingState",
        limit: "1",
    });
    const deadline = Date.now() + wait.timeoutMs;
    for (;;) {
        const { data } = await client<Page<BuildAttributes>>(
            "GET",
            `/v1/builds?${query}`
        );
        const state = data[0]?.attributes.processingState;
        if (data[0] && state === "VALID") return data[0].id;
        if (state === "FAILED" || state === "INVALID") {
            throw new Error(
                `Build ${input.version} (${input.build}) is ${state} in App Store Connect`
            );
        }
        if (Date.now() >= deadline) {
            throw new Error(
                `Build ${input.version} (${input.build}) not processed after ${wait.timeoutMs / 60_000} min`
            );
        }
        wait.log(`⏳ build ${input.build}: ${state ?? "not visible yet"}`);
        await wait.sleep(wait.pollMs);
    }
}

async function ensureVersion(
    client: Client,
    appId: string,
    version: string
): Promise<string> {
    const query = new URLSearchParams({
        "filter[platform]": "IOS",
        "filter[appVersionState]": [...EDITABLE_STATES, ...HELD_STATES].join(
            ","
        ),
        "fields[appStoreVersions]": "versionString,appVersionState",
        limit: "10",
    });
    const { data } = await client<Page<VersionAttributes>>(
        "GET",
        `/v1/apps/${appId}/appStoreVersions?${query}`
    );
    const plan = planVersion(data, version);
    if (plan.action === "create") {
        const created = await client<One<VersionAttributes>>(
            "POST",
            "/v1/appStoreVersions",
            {
                data: {
                    type: "appStoreVersions",
                    attributes: { platform: "IOS", versionString: version },
                    relationships: {
                        app: { data: { type: "apps", id: appId } },
                    },
                },
            }
        );
        return created.data.id;
    }
    if (plan.rename) {
        await client("PATCH", `/v1/appStoreVersions/${plan.id}`, {
            data: {
                type: "appStoreVersions",
                id: plan.id,
                attributes: { versionString: version },
            },
        });
    }
    return plan.id;
}

async function setWhatsNew(
    client: Client,
    versionId: string,
    notes: Notes
): Promise<string[]> {
    const { data } = await client<Page<LocalizationAttributes>>(
        "GET",
        `/v1/appStoreVersions/${versionId}/appStoreVersionLocalizations?fields[appStoreVersionLocalizations]=locale&limit=50`
    );
    for (const localization of data) {
        await client(
            "PATCH",
            `/v1/appStoreVersionLocalizations/${localization.id}`,
            {
                data: {
                    type: "appStoreVersionLocalizations",
                    id: localization.id,
                    attributes: {
                        whatsNew: notesFor(
                            localization.attributes.locale,
                            notes
                        ),
                    },
                },
            }
        );
    }
    return data.map((localization) => localization.attributes.locale);
}

export async function draftVersion(
    client: Client,
    input: { bundleId: string; version: string; build: string; notes: Notes },
    wait: Wait
): Promise<{ appId: string; versionId: string; locales: string[] }> {
    const appId = await findApp(client, input.bundleId);
    const buildId = await waitForBuild(client, { appId, ...input }, wait);
    const versionId = await ensureVersion(client, appId, input.version);
    await client(
        "PATCH",
        `/v1/appStoreVersions/${versionId}/relationships/build`,
        {
            data: { type: "builds", id: buildId },
        }
    );
    const locales = await setWhatsNew(client, versionId, input.notes);
    return { appId, versionId, locales };
}

function env(name: string): string {
    const value = process.env[name];
    if (!value) throw new Error(`${name} is not set`);
    return value;
}

if (import.meta.main) {
    const { values } = parseArgs({
        args: process.argv.slice(2),
        options: {
            "bundle-id": { type: "string", default: "id.frak.wallet" },
            version: { type: "string" },
            build: { type: "string" },
            dir: { type: "string", default: NOTES_DIR },
            "timeout-minutes": { type: "string", default: "60" },
        },
    });
    const version = values.version ?? env("VERSION");
    const notes = readNotes(values.dir);
    const client = createClient({
        keyId: env("ASC_KEY_ID"),
        issuerId: env("ASC_ISSUER_ID"),
        privateKey: env("ASC_PRIVATE_KEY"),
    });
    const result = await draftVersion(
        client,
        {
            bundleId: values["bundle-id"],
            version,
            build: values.build ?? version,
            notes,
        },
        {
            pollMs: 30_000,
            timeoutMs: Number(values["timeout-minutes"]) * 60_000,
            sleep,
            log: console.log,
        }
    );
    const url = `https://appstoreconnect.apple.com/apps/${result.appId}/distribution/ios/version/inflight`;
    const line = `🍎 ${version} drafted with its build and What's New (${result.locales.join(", ")}). Submit it for review: ${url}`;
    console.log(line);
    if (process.env.GITHUB_STEP_SUMMARY) {
        appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${line}\n`);
    }
}
