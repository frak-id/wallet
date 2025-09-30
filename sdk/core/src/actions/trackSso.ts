import type {
    FrakClient,
    TrackSsoParamsType,
    TrackSsoReturnType,
} from "../types";

/**
 * Function used to track an SSO status
 * @param client - The current Frak Client
 * @param args - The SSO parameters
 *
 * @description This function will track the SSO session, based on the provided param, and output the user stauts at the end of the session. It will be in the pending state until the SSO session is finished.
 */
export async function trackSso(
    client: FrakClient,
    args: TrackSsoParamsType
): Promise<TrackSsoReturnType> {
    const result = await client.request({
        method: "frak_trackSso",
        params: [args],
    });
    return result;
}
