import type { WebAuthNWallet } from "@/types/WebAuthN";
import type { Address, Hex } from "viem";

export type Session = {
    token: string;
} & (WebAuthNWallet | PrivyWallet);

export type PrivyWallet = {
    address: Address;
    publicKey: Hex;
    authenticatorId: `privy-${string}`;
    transports: undefined;
};

/*


 Need to generate a session token for the fallback type though
 Impact on:
  - wagmi connector
  - everything that use webauthn directly
  - wallet settings page?
  - recovery (use privy recovery insteead)

  - how to transmit the signature provider to the wagmi provider? Need to check how the privy custom conenctor is build
    - Maybe a privy store?

  - Btw, need to setup google OAuth (so google account) + PWA stuff?


  For login:
    - Privy sign msg, smth like "I accept Frak CGU by signing this message", pushed a new backend routes (login only, no rigstration on privy here)

  Transmit PrivyInstance to the wagmi connector? And then depending on the session type, check for embeded wallets with privy (if none ask to create new one)
   - Maybe with privy instance we can get the wallet provider
   - Nop, should use the useWallets hook, so LoginFallback should do multiple stuff:
    1. Privy login
    2. Privy wallets check (if none ask to create one)
    3. Sign message for backend login
    4. Transmit the wallets to the wagmi connector

  On logout, need to add the privy logout actions

 */

export type InteractionSession = {
    sessionStart: number;
    sessionEnd: number;
};

export type SdkSession = {
    token: string;
    expires: number;
};
