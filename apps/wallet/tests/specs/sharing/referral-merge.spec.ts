import {
    TARGET_BACKEND_URL,
    TARGET_HOST_URL,
} from "../../../playwright.config";
import { ReferralApi } from "../../api/referral.api";
import { expect, test } from "../../fixtures";
import { ReferrerHelper } from "../../helpers/referrer.helper";
import { assertStackReady } from "../../helpers/stack.helper";

type EnsureResponse = { status: "linked" | "already_linked" };

/**
 * The seam no other test crosses: `IdentityMergeService` re-points
 * `referral_links.referee_identity_group_id` at the surviving group, and an
 * attribution earned anonymously must survive that.
 */
// The referee wallet is minted per run, so its credential file must not
// outlive the test: a reused wallet group already holds a row for this
// (merchant, referee) pair and would send the next run down the merge's
// conflict branch.
let refereeWallet: ReferrerHelper | undefined;
test.afterEach(() => {
    refereeWallet?.forgetCredential();
    refereeWallet = undefined;
});

test("an attribution earned anonymously survives the identity merge", async ({
    referrer,
    referee,
}) => {
    const merchant = await assertStackReady();
    const referralApi = new ReferralApi(referee.page);
    await referralApi.captureArrivals();

    // 1. Earn the attribution anonymously.
    const link = await referrer.captureSharingLink();
    await referee.arriveOn(link);
    const clientId = await referee.clientId();

    const [arrival] = await referralApi.waitForArrivals(1);
    expect(arrival.referralLinkId).toBeTruthy();
    expect(
        (
            await referralApi.readReferralStatus(merchant.merchantId, {
                "x-frak-client-id": clientId,
            })
        ).isReferred,
        "baseline: the anonymous identity must hold the attribution before the merge"
    ).toBe(true);

    // 2. Register a wallet inside the referee's own context, under a name
    //    minted per run (see the teardown above for why).
    const credentialContext = `referee-${Date.now()}`;
    refereeWallet = new ReferrerHelper(referee.page, credentialContext);
    await refereeWallet.authenticate();

    // Read the SDK token here, on the wallet origin, while the page is still
    // there: the listener's `frak-wallet-interaction-token` only appears once
    // the merchant page has booted, and that boot is what fires the merge —
    // so waiting for it would make the pre-merge baseline unobservable.
    const sdkToken = await referee.page.evaluate(() => {
        const raw = localStorage.getItem("frak_session_store");
        if (!raw) return undefined;
        const parsed = JSON.parse(raw) as {
            state?: { sdkSession?: { token?: string } };
        };
        return parsed.state?.sdkSession?.token;
    });
    if (!sdkToken) {
        throw new Error("no sdkSession token after registering the referee");
    }

    const walletOnlyRead = () =>
        referralApi.readReferralStatus(merchant.merchantId, {
            "x-wallet-sdk-auth": sdkToken,
        });

    // 3. Arm the interception and take the baseline BEFORE going back to the
    //    merchant page. The SDK fires `ensureIdentity` from its own boot
    //    (`setupReferral` → `watchWalletStatus`), and that call latches a
    //    `sessionStorage` key, so a later explicit call is a no-op and the
    //    pre-merge state is gone by the time the page is up. Observe the
    //    boot-time ensure instead of racing it.
    const ensureResponses: EnsureResponse[] = [];
    await referee.page.route("**/user/identity/ensure", async (route) => {
        const response = await route.fetch();
        const body = await response.text();
        if (response.status() === 200) {
            ensureResponses.push(JSON.parse(body) as EnsureResponse);
        }
        await route.fulfill({ response, body });
    });

    const preMerge = await walletOnlyRead();
    expect(
        preMerge.isReferred,
        "before the ensure, the wallet node must not resolve the anonymous attribution — otherwise the merge proves nothing"
    ).toBe(false);

    await referee.arriveOn(TARGET_HOST_URL);

    // The boot ensure normally covers this; a status that arrived without an
    // interactionToken produces no merge, so drive it once explicitly.
    if (!ensureResponses.length) {
        await referee.page.evaluate(async () => {
            const core = window.FrakSetup?.core;
            const client = window.FrakSetup?.client;
            if (!core || !client) throw new Error("SDK not booted");
            await core.watchWalletStatus(client);
        });
        await referee.page.waitForTimeout(2_000);
    }

    expect(ensureResponses).not.toHaveLength(0);
    expect(
        ensureResponses[0].status,
        "'already_linked' means this wallet group already held the anonymous node: the credential was reused and the run proves nothing"
    ).toBe("linked");

    // 4. Read through the wallet node alone. Sending the client id too would
    //    resolve through whichever group the two share and prove nothing.
    expect((await walletOnlyRead()).isReferred).toBe(true);

    // 5. The same call, same real token and merchant, but unsigned: 403
    //    PROOF_REQUIRED. Proves the signature above carried the merge rather
    //    than the headers alone being enough.
    const proofless = await referee.page.evaluate(
        async ({ backendUrl, merchantId, clientId, sdkToken }) => {
            const response = await fetch(`${backendUrl}/user/identity/ensure`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-wallet-sdk-auth": sdkToken,
                    "x-frak-client-id": clientId,
                },
                body: JSON.stringify({ merchantId }),
            });
            return { status: response.status, body: await response.text() };
        },
        {
            backendUrl: TARGET_BACKEND_URL,
            merchantId: merchant.merchantId,
            clientId,
            sdkToken,
        }
    );
    expect(proofless.status).toBe(403);
    expect(proofless.body).toContain("PROOF_REQUIRED");
});
