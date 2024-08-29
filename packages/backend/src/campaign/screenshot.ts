import { ApiHandler } from "sst/node/api";
import puppeteer from "puppeteer-core";
import {keccak256, toHex} from "viem";
import {Bucket} from "sst/node/bucket";

export const handler = ApiHandler(async ({body, requestContext}) => {
    // Extract body as json and get domain wanted
    if (!body) {
        return {
            statusCode: 400,
            body: "No body",
        }
    }
    const { domain } = JSON.parse(body) as { domain: string };
    if (!domain || domain.startsWith("http")) {
        return {
            statusCode: 400,
            body: "No domain",
        }
    }

    // Check if we already got a screenshot for this domain
    const bucket = Bucket.CampaignStorageBucket.bucketName;
    console.log(`Checking if we already have a screenshot for ${domain} in ${bucket}`);

    // Check if our bucket already contain a screenshot for this domain (in the form domainHash.png)
    const domainHash = keccak256(toHex(domain));
    const screenshotKey = `${domainHash}.png`;



    // Format domain in the url format
    const url = `https://${domain}`;

    // Launch chromium and take a screenshot
    const chromium = require("@sparticuz/chromium");
    const browser = await puppeteer.launch({
        executablePath: await chromium.executablePath(),
        headless: chromium.headless,
        defaultViewport: chromium.defaultViewport,
        args: [...chromium.args, "--hide-scrollbars", "--disable-web-security"],
    });

    // Then close the browser
    await browser.close()

    return {
        statusCode: 200,
        body: requestContext.time,
    };
});
