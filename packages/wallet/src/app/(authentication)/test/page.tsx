"use client";

import {
    defaultUsername,
    rpId,
    rpName,
} from "@/context/wallet/smartWallet/webAuthN";
import {
    startAuthentication,
    startRegistration,
} from "@simplewebauthn/browser";
import {
    generateAuthenticationOptions,
    generateRegistrationOptions,
} from "@simplewebauthn/server";
import { useMutation } from "@tanstack/react-query";
import { fromHex, toHex } from "viem";
import {useMemo} from "react";
import InAppSpy from "inapp-spy";

export default function TestWebAuthn() {

    const { isInApp, appKey, appName } = useMemo(() => InAppSpy(), []);


    const {
        data: loginData,
        status: loginStatus,
        error: loginError,
        mutate: login,
    } = useMutation({
        mutationKey: ["login", "test"],
        mutationFn: async () => {
            const authenticationOptions = await generateAuthenticationOptions({
                rpID: rpId,
                userVerification: "required",
                // timeout in ms (3min, can be useful for mobile phone linking)
                timeout: 180_000,
            });
            return await startAuthentication(authenticationOptions);
        },
    });

    const {
        data: registerData,
        status: registerStatus,
        error: registerError,
        mutate: register,
    } = useMutation({
        mutationKey: ["register", "test"],
        mutationFn: async () => {
            // Generate the options
            const authenticationOptions = await generateRegistrationOptions({
                rpName,
                rpID: rpId,
                userID: fromHex(toHex(defaultUsername), "bytes"),
                userName: defaultUsername,
                userDisplayName: defaultUsername,
                // timeout in ms (3min, can be useful for mobile phone linking)
                timeout: 180_000,
                attestationType: "direct",
                authenticatorSelection: {
                    requireResidentKey: true,
                    authenticatorAttachment: undefined,
                    userVerification: "required",
                },
                supportedAlgorithmIDs: [-7],
                excludeCredentials: [],
            });
            return await startRegistration(authenticationOptions);
        },
    });

    return (
        <>
            <h1>Test WebAuthN</h1>

            <h3>Login</h3>
            <button onClick={() => login()} type={"button"}>
                Login
            </button>
            <p>Status: {loginStatus}</p>
            <p>Error: {loginError?.message}</p>
            <pre>Data: {JSON.stringify(loginData)}</pre>

            <hr/>

            <h3>Register</h3>
            <button onClick={() => register()} type={"button"}>
                Register
            </button>
            <p>Status: {registerStatus}</p>
            <p>Error: {registerError?.message}</p>
            <pre>Data: {JSON.stringify(registerData)}</pre>

            <h3>Test</h3>
            <button
                onClick={async () => {
                    if (!("Notification" in window)) {
                        // Check if the browser supports notifications
                        alert(
                            "This browser does not support desktop notification"
                        );
                    } else if (Notification.permission === "granted") {
                        const notification = new Notification("Hi there!");
                        console.log("Notification:", notification);
                    } else {
                        const result = await Notification.requestPermission();
                        console.log("Notification permission:", result);
                    }
                }}
                type={"button"}
            >
                Test notification
            </button>

            <br/>
            <br/>

            <a href={"/test"} target={"_blank"} rel={"noreferrer"}>
                Test redir _blank
            </a>

            <br/>
            <br/>

            <a href={"/test"} target={"_blank"} rel={"noopener noreferrer"}>
                Test redir _blank noopener
            </a>

            <hr/>
            <h3>Test custom open</h3>

            <br/>
            <button
                onClick={() => {
                    window.open("/test", '_blank', 'noopener,noreferrer');
                }}
                type={"button"}
            >
                Test open _blank
            </button>

            <br/>
            <button
                onClick={() => {
                    window.open(window.location.href, '_system')
                }}
                type={"button"}
            >
                Test open _system
            </button>

            <br/>
            <button
                onClick={() => {
                    const newWindow = window.open('', '_system');
                    if (newWindow) {
                        newWindow.location.href = "https://nexus-dev.frak.id/test";
                    } else {
                        alert("Cannot open new window");
                    }
                }}
                type={"button"}
            >
                Test new window
            </button>

            <br/>

            <p>Current user agent {navigator.userAgent}</p>

            <p>Working on instagram</p>
            <a href={"intent:https://nexus-dev.frak.id/test#Intent;end"} target={"_blank"} rel={"noreferrer"}>
                Test with intent
            </a>

            <br/>
            <br/>

            <p>InApp info:</p>
            <p>Is in app: {isInApp ? "Yes" : "No"}</p>
            <p>App key: {appKey}</p>
            <p>App name: {appName}</p>

            <hr/>

            <h3>Test specific</h3>

            <button
                onClick={async () => {
                    window.location.href = `instagram://external_browser?url=${encodeURIComponent(window.location.href)}`;
                }}
                type={"button"}
            >
                Instagram
            </button>

            <br />

            <button
                onClick={async () => {
                    window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(window.location.href)}`, '_system')
                }}
                type={"button"}
            >
                Facebook
            </button>
        </>
    );
}
