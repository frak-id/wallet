# Frak Wallet components

Those components are meant to be used to interact with the [Frak Wallet](https://wallet.frak.id/).

They are built as [Web Components](https://developer.mozilla.org/en-US/docs/Web/API/Web_components), so you can use them in any web project, no matter the framework you are using.

Checkout our documentation for more information's about the usage:
 - [Core client usage](https://docs.frak.id/wallet-sdk/integration-guide/vanilla-js)

To have more info about how does it works under the hood, you can check [this](https://docs.frak.id/wallet-sdk/under-the-hood)

## Setup

Add the following script tag to your HTML file:

```html
<script src="https://cdn.jsdelivr.net/npm/@frak-labs/components@latest/dist/components.js" defer="defer"></script>
```

## Quick start

Add a minimal configuration:

```javascript
window.FrakSetup = {
    config: {
        metadata: {
            name: "Your App Name",
        },
    },
};
```

## Sample usage

Sample code to use share button:

```html
<frak-button-share></frak-button-share>
```

Button with custom text:

```html
<frak-button-share text="Share with Frak Wallet"></frak-button-share>
```

Button with custom class:

```html
<frak-button-share classname="button"></frak-button-share>
```
