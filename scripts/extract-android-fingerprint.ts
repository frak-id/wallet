#!/usr/bin/env bun

/**
 * Extract the SHA-256 fingerprint of an Android keystore in the two formats the
 * infra needs: colon-hex for `ANDROID_SHA256_FINGERPRINT` (assetlinks.json + SST
 * secret) and base64url for the WebAuthn `android:apk-key-hash` origin.
 */

function colonHexToBase64url(colonHex: string): string {
    const bytes = new Uint8Array(
        colonHex.split(":").map((b) => Number.parseInt(b, 16))
    );
    const base64 = btoa(String.fromCharCode(...bytes));
    return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function isColonHex(input: string): boolean {
    return /^([0-9A-Fa-f]{2}:){31}[0-9A-Fa-f]{2}$/.test(input);
}

async function extractFromKeystore(
    keystorePath: string,
    alias: string
): Promise<string> {
    const proc = Bun.spawn(
        ["keytool", "-list", "-v", "-keystore", keystorePath, "-alias", alias],
        { stdin: "pipe", stdout: "pipe", stderr: "pipe" }
    );

    // keytool prompts for password — send empty line for unsigned debug keystores
    // or pipe the password via stdin for signed keystores
    const password = process.env.KEYSTORE_PASSWORD ?? "";
    proc.stdin.write(`${password}\n`);
    proc.stdin.end();

    const stdout = await new Response(proc.stdout).text();
    const stderr = await new Response(proc.stderr).text();
    const exitCode = await proc.exited;

    if (exitCode !== 0) {
        console.error("keytool failed:", stderr);
        process.exit(1);
    }

    const match = stdout.match(
        /SHA256:\s*([0-9A-Fa-f]{2}(?::[0-9A-Fa-f]{2}){31})/
    );
    if (!match?.[1]) {
        console.error("Could not find SHA-256 fingerprint in keytool output.");
        console.error("Raw output:\n", stdout);
        process.exit(1);
    }

    return match[1];
}

function printResults(colonHex: string): void {
    const base64url = colonHexToBase64url(colonHex);

    console.log("─".repeat(60));
    console.log("Android signing key SHA-256 fingerprint\n");
    console.log("ANDROID_SHA256_FINGERPRINT (SST secret / assetlinks.json):");
    console.log(`  ${colonHex}\n`);
    console.log("WebAuthn origin (derived automatically at runtime):");
    console.log(`  android:apk-key-hash:${base64url}`);
    console.log("─".repeat(60));
    console.log("\nTo set the SST secret:");
    console.log(
        `  bunx sst secret set ANDROID_SHA256_FINGERPRINT "${colonHex}"`
    );
}

const args = process.argv.slice(2);

if (args.length === 0) {
    console.error(
        "Usage:\n" +
            "  bun scripts/extract-android-fingerprint.ts <keystore> <alias>\n" +
            "  bun scripts/extract-android-fingerprint.ts <colon-hex-fingerprint>\n" +
            "\nSet KEYSTORE_PASSWORD env var for signed keystores."
    );
    process.exit(1);
}

if (args.length === 1 && isColonHex(args[0])) {
    printResults(args[0]);
} else if (args.length >= 2) {
    const fingerprint = await extractFromKeystore(args[0], args[1]);
    printResults(fingerprint);
} else {
    console.error(
        "Invalid arguments. Provide either a colon-hex fingerprint or <keystore> <alias>."
    );
    process.exit(1);
}
