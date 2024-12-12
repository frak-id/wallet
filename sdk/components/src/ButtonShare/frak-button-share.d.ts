interface ButtonShareElement extends HTMLElement {
    text: string;
    classname?: string;
}

declare global {
    interface HTMLElementTagNameMap {
        "frak-button-share": ButtonShareElement;
    }
}
