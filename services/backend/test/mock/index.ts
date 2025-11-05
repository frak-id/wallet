import { mockOx, mockPermissionlessActions, mockViemActions } from "./viem";
import { mockWebauthn } from "./webauthn";

export function mockAll() {
    mockViemActions();
    mockPermissionlessActions();
    mockWebauthn();
    mockOx();
}

export { oxMocks, permissionlessActionsMocks, viemActionsMocks } from "./viem";
export { webauthnMocks } from "./webauthn";
