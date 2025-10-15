import { mockPermissionlessActions, mockViemActions } from "./viem";
import { mockWebauthn } from "./webauthn";

export function mockAll() {
    mockViemActions();
    mockPermissionlessActions();
    mockWebauthn();
}
