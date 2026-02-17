import styles from "./index.module.css";

type SocialPreviewProps = {
    title: string;
    text: string;
};

export function SocialPreview({ title, text }: SocialPreviewProps) {
    return (
        <div className={styles.socialPreview}>
            <SocialPreviewChat title={title} text={text} />
            <SocialPreviewInput />
        </div>
    );
}

function SocialPreviewChat({ title, text }: SocialPreviewProps) {
    return (
        <div className={styles.chatArea}>
            <div className={styles.messageBubble}>
                <p>
                    {title}
                    <br />
                    <a
                        href="https://www.example.com/products/my-amazing-product"
                        className={styles.messageLink}
                    >
                        https://www.example.com/products/my-amazing-product
                    </a>
                    <br />
                    {text}
                </p>
            </div>
        </div>
    );
}

function SocialPreviewInput() {
    return (
        <div className={styles.inputContainer}>
            <button type="button" className={styles.addButton}>
                +
            </button>
            <input
                type="text"
                className={styles.messageInput}
                placeholder="Tapez un message"
            />
            <button type="button" className={styles.emojiButton}>
                😊
            </button>
            <button type="button" className={styles.sendButton}>
                ➤
            </button>
        </div>
    );
}
