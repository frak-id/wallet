"use client";

import { ModalWalletConnectRequest } from "@/module/wallet-connect/component/ModalRequest";
import { useWalletConnect } from "@/module/wallet-connect/provider/WalletConnectProvider";
import { useMutation } from "@tanstack/react-query";
import type { ProposalTypes, SessionTypes, Verify } from "@walletconnect/types";
import type { Web3WalletTypes } from "@walletconnect/web3wallet";
import { useCallback, useEffect, useState } from "react";
import type { PropsWithChildren } from "react";

/**
 * Represent wallet connect modal data
 */
export type WalletConnectRequestArgs = {
    id: number;
    verifyContext: Verify.Context;
} & (
    | {
          type: "pairing";
          params: ProposalTypes.Struct;
      }
    | {
          type: "request";
          topic: string;
          params: {
              request: {
                  method: string;
                  // biome-ignore lint/suspicious/noExplicitAny: Type from wallet connect interface
                  params: any;
              };
              chainId: string;
          };
          session: SessionTypes.Struct;
      }
);

/**
 * Component handling wallet connect events
 * @param children
 * @constructor
 * TODO: Each proposal as an ID
 *   - Store of queued ID proposals + expiration + type + verify context
 *   - Proposal can be pairing or request
 */
export function EventsWalletConnect({ children }: PropsWithChildren) {
    const { walletConnectInstance, refreshSessions } = useWalletConnect();

    /**
     * All the requests that are currently pending
     * TODO: Should have a small indicator with a list of pending requests
     */
    const [_requests, setRequests] = useState<WalletConnectRequestArgs[]>([]);

    /**
     * The current request that is being displayed
     */
    const [currentRequest, setCurrentRequest] = useState<
        WalletConnectRequestArgs | undefined
    >(undefined);

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
            // Build our request args
            const args: WalletConnectRequestArgs = {
                id,
                type: "pairing",
                params,
                verifyContext,
            };
            console.log("Wallet connect session proposal", {
                args,
            });

            // Store the pairing proposal
            setRequests((prev) => [...prev, args]);

            // If no current request, display it directly
            if (!currentRequest) {
                setCurrentRequest(args);
            }
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

            console.log("Wallet connect session request", {
                args,
            });

            requestSession.peer.metadata;

            // Store the pairing proposal
            setRequests((prev) => [...prev, args]);

            // If no current request, display it directly
            if (!currentRequest) {
                setCurrentRequest(args);
            }
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
            setRequests((prev) => prev.filter((req) => req.id !== id));

            // If that's the currently displayed one, remove it
            if (currentRequest?.id === id) {
                // TODO: If that's the currently displayed one, maybe a small info like expired and soft close with 1-2sec delay?
                setCurrentRequest(undefined);
            }
        },
    });

    /**
     * Callback when a session is deleted
     */
    const { mutate: onSessionDelete } = useMutation({
        mutationKey: ["on-session-delete"],
        mutationFn: async ({ id, topic }: Web3WalletTypes.SessionDelete) => {
            console.log("Wallet connect session delete", { id, topic });
            if (!walletConnectInstance) return;
            await refreshSessions();
        },
    });

    /**
     * Listener to the wallet connect event
     */
    useEffect(() => {
        if (!walletConnectInstance) return;
        console.log("Wallet connect event listener attached");

        // TODO: Initial with load of `getPendingSessionProposals` and `getPendingSessionRequests`

        // Pairing and request events
        walletConnectInstance.on("session_proposal", onSessionProposal);
        walletConnectInstance.on("session_request", onSessionRequest);

        // Expiration events
        walletConnectInstance.on("proposal_expire", onProposalExpire);
        walletConnectInstance.on("session_request_expire", onProposalExpire);

        // Auth request??? Seems like pairing + SIWE combined
        walletConnectInstance.on("auth_request", (proposal) => {
            console.log("Wallet connect auth request", { proposal });
        });

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
        onProposalExpire,
        onSessionDelete,
    ]);

    const onModalClose = useCallback(() => {
        // Get the current request
        const request = currentRequest;
        // Remove the request from the list
        setCurrentRequest(undefined);
        // If we have a request, remove it from the list
        if (request) {
            setRequests((prev) => prev.filter((req) => req.id !== request.id));
        }
    }, [currentRequest]);

    return (
        <>
            {currentRequest && (
                <ModalWalletConnectRequest
                    args={currentRequest}
                    onClose={onModalClose}
                />
            )}
            {children}
        </>
    );
}

/**
 * TODO: WalletConnect Modal component
 *  - Handling pairing or request modal
 *  - Generic component to display global info about the context and stuff
 *  - Display and accept / reject the request
 */
