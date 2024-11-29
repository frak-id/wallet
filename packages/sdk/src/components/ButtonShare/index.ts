import { LitElement, html } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { onClientReady } from "../utils";

@customElement("frak-button-share")
export class ButtonShare extends LitElement {
    // Deactivate shadow DOM, otherwise styles are not propagated from the parent
    override createRenderRoot() {
        return this;
    }

    @property({ type: String })
    classname = "";

    @property({ type: String })
    text = "Share and earn!";

    @state()
    disabled = true;

    constructor() {
        super();
        this.handleClientReady = this.handleClientReady.bind(this);
    }

    handleClientReady() {
        this.disabled = false;
        this.requestUpdate();
    }

    modalShare() {
        window.FrakSetup.modalBuilderSteps
            .sharing(window.FrakSetup.modalShareConfig)
            .display();
    }

    override connectedCallback() {
        super.connectedCallback();
        onClientReady("add", this.handleClientReady);
    }

    override disconnectedCallback() {
        super.disconnectedCallback();
        onClientReady("remove", this.handleClientReady);
    }

    override render() {
        return html`<button class=${this.classname} @click=${this.modalShare} ?disabled=${this.disabled}>${this.text}</button>`;
    }
}

declare global {
    interface HTMLElementTagNameMap {
        "frak-button-share": ButtonShare;
    }
}
