// Clients
export type { PairingWsEventListener } from "./clients/base";
export { BasePairingClient } from "./clients/base";
export type {
    OnPairingSuccessCallback,
    OriginPairingClient,
} from "./clients/origin";
export {
    getOriginPairingClient,
    getTargetPairingClient,
} from "./clients/store";
export { TargetPairingClient } from "./clients/target";
// Components
export { LaunchPairing } from "./component/LaunchPairing";
export { OriginPairingState } from "./component/OriginPairingState";
export { PairingStatus } from "./component/PairingStatus";
export {
    StatusBoxModal,
    StatusBoxWallet,
    StatusBoxWalletEmbedded,
} from "./component/PairingStatusBox";
export { PairingView } from "./component/PairingView";
// Hooks
export { useDeletePairing } from "./hook/useDeletePairing";
export { useGetActivePairings } from "./hook/useListPairings";
export {
    isPairingNotFoundError,
    PairingNotFoundError,
    usePairingInfo,
} from "./hook/usePairingInfo";
export { usePersistentPairingClient } from "./hook/usePersistentPairingClient";
export {
    useDeclineSignatureRequest,
    useSignSignatureRequest,
} from "./hook/useSignSignatureRequest";
// Query Keys
export { pairingKey } from "./queryKeys";
// Types
export type {
    BasePairingState,
    OriginIdentityNode,
    TargetPairingIdState,
    TargetPairingPendingSignature,
    TargetPairingState,
    WsCloseCode,
} from "./types/index";

// Note: Types are not re-exported from the barrel due to naming conflicts
// Import types directly from "./pairing/types" if needed
