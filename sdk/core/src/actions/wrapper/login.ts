import type { FrakClient } from "../../types";
import type { LoginModalStepType } from "../../types/rpc/modal/login";
import { displayModal } from "../displayModal";

export type LoginModalParams = LoginModalStepType["params"];
export type LoginReturnType = LoginModalStepType["returns"];

export async function login(
    client: FrakClient,
    params?: LoginModalParams
): Promise<LoginReturnType> {
    const result = await displayModal(client, {
        steps: {
            login: params ?? {},
        },
    });
    return result.login;
}
