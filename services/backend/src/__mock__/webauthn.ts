import { spyOn } from "bun:test";
import * as webauthn from "@simplewebauthn/server";

const verifySpy = spyOn(webauthn, "verifyAuthenticationResponse");

export const webauthnMocks = {
    ...webauthn,
    verifyAuthenticationResponse: verifySpy,
};
