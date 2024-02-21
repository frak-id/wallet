"use client";

import { useArticlePrices } from "@/module/paywall/hook/useArticlePrices";
import { useUnlockState } from "@/module/paywall/hook/useUnlockState";
import { useUserStatus } from "@/module/wallet/hooks/useUserStatus";
import {
    type GetUnlockStatusResponse,
    type GetUserStatusResponse,
    QueryListener,
} from "@frak-wallet/sdk";
import { useEffect, useState } from "react";
import type { Hex } from "viem";

type UnlockStateListenerParam = {
    contentId: Hex;
    articleId: Hex;
    emitter: (response: GetUnlockStatusResponse) => Promise<void>;
};

type UserStateListenerParam = {
    emitter: (response: GetUserStatusResponse) => Promise<void>;
};

const queryListener = new QueryListener();

export function ListenerUI() {
    // Hook used to fetch the prices
    const { fetchPrices } = useArticlePrices();

    // Info required to fetch the unlock status
    const [unlockStatusParam, setUnlockStatusParam] = useState<
        UnlockStateListenerParam | undefined
    >(undefined);
    const { unlockState } = useUnlockState({
        contentId: unlockStatusParam?.contentId,
        articleId: unlockStatusParam?.articleId,
    });

    // Info required about the user status
    const [userStatusParam, setUserStatusParam] = useState<
        UserStateListenerParam | undefined
    >(undefined);

    // Listen to the current user status
    const { userStatus } = useUserStatus();

    // Bind the fetch price hook
    useEffect(() => {
        if (!fetchPrices) {
            return;
        }

        queryListener.onPriceRequested = fetchPrices;
        queryListener.onUnlockStatusRequested = async (param, emitter) => {
            setUnlockStatusParam({
                contentId: param.contentId,
                articleId: param.articleId,
                emitter,
            });
        };
        queryListener.onUserStatusRequested = async (_, emitter) => {
            setUserStatusParam({ emitter });
        };

        // Tell that the listener is rdy to handle data
        queryListener.setReadyToHandleRequest();

        // Cleanup the listener on destroy
        return () => {
            queryListener.onPriceRequested = async (_) => {
                return undefined;
            };
            queryListener.onUnlockStatusRequested = async () => {};
        };
    }, [fetchPrices]);

    // Every time the unlock state change, send it to the listener
    useEffect(() => {
        if (unlockState) {
            console.log("Sending the unlock state to the listener", {
                unlockState,
            });
            unlockStatusParam?.emitter(unlockState);
        }
    }, [unlockState, unlockStatusParam]);

    // Every time the user status change, send it to the listener
    useEffect(() => {
        if (userStatus) {
            console.log("Sending the user status to the listener", {
                userStatus,
                userStatusEmitter: userStatusParam,
            });
            userStatusParam?.emitter(userStatus);
        }
    }, [userStatus, userStatusParam]);

    return <h1>Listener</h1>;
}
