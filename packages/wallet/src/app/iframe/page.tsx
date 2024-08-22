"use client";

import { getSession } from "@/context/session/action/session";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";

/**
 * Simple page to test iframe-query storage sharing between cross domain applications
 */
export default function IFrameTesterReceiver() {
    return (
        <div>
            <h1>Iframe tester receiver</h1>
            <hr />
            <IFrameStorageStatus />
            <hr />
            <IFrameStorageRequester />
            <hr />
            <IFrameSetStorage />
            <hr />
            <IFrameListener />
        </div>
    );
}

function IFrameStorageStatus() {
    const { data, refetch, error } = useQuery({
        queryKey: ["iframe-query-tester-state"],
        queryFn: async () => {
            // Check if the storage api exist
            const apiExist = !!document.hasStorageAccess;
            const hasStorageAccess = apiExist
                ? await document.hasStorageAccess()
                : false;

            // Fetch the test storage item
            const testStorageItem = localStorage.getItem("test");
            const storageAccessResult = localStorage.getItem(
                "storageAccessResult"
            );

            // Fetch the current user session
            const session = await getSession();

            return {
                apiExist,
                hasStorageAccess,
                testStorageItem,
                storageAccessResult,
                session,
            };
        },
    });

    return (
        <div>
            <h2>Status</h2>
            <p>API exist: {data?.apiExist ? "yes" : "no"}</p>
            <p>Has access: {data?.hasStorageAccess ? "yes" : "no"}</p>
            <p>Test storage item: {data?.testStorageItem}</p>
            <p>Storage access result: {data?.storageAccessResult}</p>
            <p>Session: {data?.session?.wallet?.address ?? "undefined"}</p>
            {error && <p>Error: {error.message}</p>}
            <button onClick={() => refetch()} type={"button"}>
                Refresh
            </button>
        </div>
    );
}

function IFrameStorageRequester() {
    const { mutate } = useMutation({
        mutationKey: ["storage-request"],
        mutationFn: async () => {
            await document.requestStorageAccess();
            const accessPostRequest = await document.hasStorageAccess();
            console.log("Request storage access result", accessPostRequest);
            localStorage.setItem(
                "storageAccessResult",
                accessPostRequest.toString()
            );
        },
    });

    return (
        <div>
            <h2>Request storage</h2>
            <button
                onClick={() => {
                    mutate();
                }}
                type={"button"}
            >
                Request storage access
            </button>
        </div>
    );
}

function IFrameSetStorage() {
    return (
        <div>
            <h2>Set storage</h2>
            <button
                onClick={() => {
                    console.log("Setting test storage");
                    localStorage.setItem("test", "hello");

                    // @ts-ignore
                    window.sharedStorage?.set("test", "hello", {
                        ignoreIfPresent: true,
                    });
                }}
                type={"button"}
            >
                Set test storage
            </button>
            <button
                onClick={() => {
                    localStorage.removeItem("test");
                }}
                type={"button"}
            >
                Clean test storage
            </button>
        </div>
    );
}

function IFrameListener() {
    const [queryCount, setQueryCount] = useState<number>(0);

    useMemo(() => {
        if (!window) return;

        // Define the message listener
        const onMessage = async (
            message: MessageEvent<{ testStorageAccess?: boolean }>
        ) => {
            if (!message.data?.testStorageAccess) {
                return;
            }
            setQueryCount((count) => count + 1);
            console.log("Received a message from the iframe-query", message);

            // Get our test storage item
            const testStorageItem = localStorage.getItem("test");

            // Answer back to the client with it's value
            message.source?.postMessage(
                {
                    testStorageResponse: true,
                    testStorageItem,
                },
                {
                    targetOrigin: message.origin,
                }
            );
        };

        // Add the message listener
        window.addEventListener("message", onMessage);

        // Small cleanup function
        return () => {
            window.removeEventListener("message", onMessage);
        };
    }, []);

    return (
        <div>
            <h2>Iframe listener</h2>
            <p>Received {queryCount} queries</p>
            <hr />
        </div>
    );
}
