import type { WebAuthNWallet } from "@/types/WebAuthN";

export type Session = WebAuthNWallet & {
    token: string;
};

/*

* A new session would looks like either:
 token: string
 wallet: Address
 { type: "webauthn" ...},
 { type: "fallback" ...}

 Need to generate a session token for the fallback type though
 Impact on:
  - wagmi connector
  - everything that use webauthn directly
  - backend authentication
  - wallet settings page?

  - how to transmit the signature provider to the wagmi provider? Need to check how the privy custom conenctor is build
    - Maybe a privy store?

  - Btw, need to setup google OAuth (so google account) + PWA stuff?

 */

export type InteractionSession = {
    sessionStart: number;
    sessionEnd: number;
};

export type SdkSession = {
    token: string;
    expires: number;
};
