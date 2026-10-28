export type InstagramConfig = {
    /** The Instagram app secret (not the Meta app one): signs every webhook delivery. */
    appSecret: string;
    /** Echoed by Meta when the webhook URL is registered. */
    verifyToken: string;
    /** First token of the connected account; the database keeps the renewed ones. */
    seedAccessToken: string;
};

type InstagramEnv = Record<string, string | undefined>;

/** Null unless all three secrets are set: certification is off without any of them. */
export function readInstagramConfig(
    env: InstagramEnv = process.env
): InstagramConfig | null {
    const appSecret = env.INSTAGRAM_APP_SECRET?.trim();
    const verifyToken = env.INSTAGRAM_WEBHOOK_VERIFY_TOKEN?.trim();
    const seedAccessToken = env.INSTAGRAM_ACCESS_TOKEN?.trim();
    if (!(appSecret && verifyToken && seedAccessToken)) return null;
    return { appSecret, verifyToken, seedAccessToken };
}
