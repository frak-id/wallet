import * as styles from "./styles.css";

export type SocialPreviewProps = {
    title: string;
    text: string;
    /** URL being shared; drives the link card's host row. */
    link: string;
    /** Image the receiving app renders above the link card, when it has one. */
    imageUrl?: string;
};

type LinkCardProps = {
    title: string;
    link: string;
    imageUrl?: string;
};

/**
 * Preview of how a referral link looks when shared on social media / messaging
 * apps.
 *
 * Decorative in full: a picture of a chat, not a chat. Hidden from assistive
 * tech and taken out of the tab order as one unit — the mock's chrome would
 * otherwise inject four inert stops into the middle of the surrounding form.
 */
export function SocialPreview({
    title,
    text,
    link,
    imageUrl,
}: SocialPreviewProps) {
    return (
        <div
            className={styles.socialPreview}
            aria-hidden="true"
            data-testid="social-preview"
        >
            <SocialPreviewChat
                title={title}
                text={text}
                link={link}
                imageUrl={imageUrl}
            />
            <SocialPreviewInput />
        </div>
    );
}

/**
 * The unfurled link card: what `EXTRA_TITLE` / `LPLinkMetadata.title` and the
 * brand image carry into the receiving app. Without an image the title and host
 * rows still render, so a merchant who set no logo sees a smaller card.
 */
function LinkCard({ title, link, imageUrl }: LinkCardProps) {
    return (
        <div className={styles.linkCard}>
            {imageUrl && (
                <img src={imageUrl} alt="" className={styles.linkCardImage} />
            )}
            <div className={styles.linkCardBody}>
                <span
                    className={styles.linkCardTitle}
                    data-testid="link-card-title"
                >
                    {title}
                </span>
                <span
                    className={styles.linkCardHost}
                    data-testid="link-card-host"
                >
                    {/* Regex, not `new URL`: a half-typed link must not throw. */}
                    {link
                        .replace(/^[a-z][a-z0-9+.-]*:\/\//i, "")
                        // Userinfo stripped: `https://a@evil.example@host`.
                        .replace(/^[^/?#]*@/, "")
                        .replace(/[/?#].*$/, "")}
                </span>
            </div>
        </div>
    );
}

function SocialPreviewChat({
    title,
    text,
    link,
    imageUrl,
}: SocialPreviewProps) {
    return (
        <div className={styles.chatArea}>
            <div className={styles.messageBubble}>
                <LinkCard title={title} link={link} imageUrl={imageUrl} />
                <p className={styles.messageBody}>
                    {title}
                    <br />
                    {/* Inert: a live anchor would navigate the dashboard away. */}
                    <span className={styles.messageUrl}>{link}</span>
                    <br />
                    {text}
                </p>
            </div>
        </div>
    );
}

/** Chat chrome, drawn not built: `span`/`div`, so nothing here is focusable. */
function SocialPreviewInput() {
    return (
        <div className={styles.inputContainer}>
            <span className={styles.addButton}>+</span>
            <div className={styles.messageInput}>Type a message</div>
            <span className={styles.emojiButton}>😊</span>
            <span className={styles.sendButton}>➤</span>
        </div>
    );
}
