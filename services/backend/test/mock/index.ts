import { mockViemActions } from "./viem";
import { mockPermissionlessActions } from "./viem";
import { mockWebauthn } from "./webauthn";

export function mockAll() {
    mockViemActions();
    mockPermissionlessActions();
    mockWebauthn();
}
