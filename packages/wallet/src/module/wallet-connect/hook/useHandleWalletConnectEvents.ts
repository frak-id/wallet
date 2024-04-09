import {
    wcAddNewRequestAtom,
    wcRemoveRequestAtom,
} from "@/module/wallet-connect/atoms/events";
import type { WalletConnectRequestArgs } from "@/module/wallet-connect/types/event";
import { useMutation } from "@tanstack/react-query";
import type Web3Wallet from "@walletconnect/web3wallet";
import type { Web3WalletTypes } from "@walletconnect/web3wallet";
import { useSetAtom } from "jotai/index";
import { useEffect } from "react";

/**
 * Hook used to handle the wallet connect events
 */
export function useHandleWalletConnectEvents({
    walletConnectInstance,
}: {
    walletConnectInstance: Web3Wallet | undefined;
}) {
    /**
     * Handle the request list
     */
    const addRequest = useSetAtom(wcAddNewRequestAtom);
    const removeRequest = useSetAtom(wcRemoveRequestAtom);

    /**
     * When we receive a session proposal
     * @param id
     * @param params
     * @param verifyContext
     */
    const { mutate: onSessionProposal } = useMutation({
        mutationKey: ["on-session-proposal"],
        mutationFn: async ({
            id,
            params,
            verifyContext,
        }: Web3WalletTypes.SessionProposal) => {
            console.log("Wallet connect session proposal", { id });
            // Build our request args
            const args: WalletConnectRequestArgs = {
                id,
                type: "pairing",
                params,
                verifyContext,
            };

            // Store the pairing proposal
            addRequest(args);
        },
    });

    /**
     * Callback when a session perform a request
     * @param proposal
     */
    const { mutate: onSessionRequest } = useMutation({
        mutationKey: ["on-session-request"],
        mutationFn: async ({
            id,
            topic,
            params,
            verifyContext,
        }: Web3WalletTypes.SessionRequest) => {
            // Get the matching session, if none exit directly
            const requestSession =
                walletConnectInstance?.engine?.signClient?.session?.get(topic);
            if (!requestSession) return;

            // Build our request args
            const args: WalletConnectRequestArgs = {
                id,
                topic,
                type: "request",
                params,
                verifyContext,
                session: requestSession,
            };

            // Store the pairing proposal
            addRequest(args);
        },
    });

    /**
     * Callback when we receive an auth request
     * @param proposal
     */
    const { mutate: onAuthRequest } = useMutation({
        mutationKey: ["on-auth-request"],
        mutationFn: async ({
            id,
            topic,
            params,
        }: Web3WalletTypes.AuthRequest) => {
            console.log("Wallet connect auth request", { id });
            // Build our request args
            const args: WalletConnectRequestArgs = {
                id,
                topic,
                type: "auth",
                params,
            };

            // Store the pairing proposal
            addRequest(args);
        },
    });

    /**
     * Callback when a proposal expires
     */
    const { mutate: onProposalExpire } = useMutation({
        mutationKey: ["on-proposal-expire"],
        mutationFn: async ({ id }: Web3WalletTypes.ProposalExpire) => {
            console.log("Wallet connect proposal expire", { id });

            // Remove the request from the list
            removeRequest(id);
        },
    });

    /**
     * Callback when a session is deleted
     * TODO: Remove all the associated session requests? Invalidate queries?
     */
    const { mutate: onSessionDelete } = useMutation({
        mutationKey: ["on-session-delete"],
        mutationFn: async ({ id, topic }: Web3WalletTypes.SessionDelete) => {
            console.log("Wallet connect session delete", { id, topic });
            if (!walletConnectInstance) return;
        },
    });

    /**
     * Listener to the wallet connect event
     */
    useEffect(() => {
        if (!walletConnectInstance) return;
        console.log("Wallet connect event listener attached");

        // TODO: Initial with load of `getPendingSessionProposals` (we don't have the verifyContext on pending proposals), and also pending auth stuff

        // Handle each pending requests
        const requests = walletConnectInstance.getPendingSessionRequests();
        for (const request of Object.values(requests)) {
            // Handle the request
            onSessionRequest(request);
        }

        // Pairing and request events
        walletConnectInstance.on("session_proposal", onSessionProposal);
        walletConnectInstance.on("session_request", onSessionRequest);

        // Expiration events
        walletConnectInstance.on("proposal_expire", onProposalExpire);
        walletConnectInstance.on("session_request_expire", onProposalExpire);

        // Auth request??? Seems like pairing + SIWE combined
        walletConnectInstance.on("auth_request", onAuthRequest);

        // On session delete, refresh the sessions
        walletConnectInstance.on("session_delete", onSessionDelete);

        return () => {
            console.log("Wallet connect event listener cleaned");

            walletConnectInstance.removeListener(
                "session_proposal",
                onSessionProposal
            );
            walletConnectInstance.removeListener(
                "session_request",
                onSessionRequest
            );
            walletConnectInstance.removeListener(
                "proposal_expire",
                onProposalExpire
            );
            walletConnectInstance.removeListener(
                "session_request_expire",
                onProposalExpire
            );
            walletConnectInstance.removeListener(
                "session_delete",
                onSessionDelete
            );
        };
    }, [
        walletConnectInstance,
        onSessionProposal,
        onSessionRequest,
        onAuthRequest,
        onProposalExpire,
        onSessionDelete,
    ]);
}
