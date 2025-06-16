import { spyOn } from "bun:test";
import * as webauthn from "@simplewebauthn/server";

let verifySpy = spyOn(webauthn, "verifyAuthenticationResponse");

export const webauthnMocks = {
    ...webauthn,
    verifyAuthenticationResponse: verifySpy,
};

export function mockWebauthn() {
    verifySpy = spyOn(webauthn, "verifyAuthenticationResponse");

    webauthnMocks.verifyAuthenticationResponse = verifySpy;
}
