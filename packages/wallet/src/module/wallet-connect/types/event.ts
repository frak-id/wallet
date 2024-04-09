import type { AuthClientTypes } from "@walletconnect/auth-client";
import type { ProposalTypes, SessionTypes, Verify } from "@walletconnect/types";

/**
 * Represent wallet connect modal data
 */
export type WalletConnectRequestArgs = {
    id: number;
} & (
    | {
          type: "pairing";
          params: ProposalTypes.Struct;
          topic?: never;
          verifyContext: Verify.Context;
      }
    | {
          type: "auth";
          topic: string;
          params: AuthClientTypes.AuthRequestEventArgs;
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
          verifyContext: Verify.Context;
      }
);
