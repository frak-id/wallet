# Frak Wallet components

Those components are meant to be used to interact with the [Frak Wallet](https://wallet.frak.id/).

They are built as [Web Components](https://developer.mozilla.org/en-US/docs/Web/API/Web_components), so you can use them in any web project, no matter the framework you are using.

See the documentation for usage:
 - [Components](https://docs.frak.id/components)
 - [Share Button usage](https://docs.frak.id/components/share-button)
 - [Wallet Button usage](https://docs.frak.id/components/wallet-button)

How it works under the hood: [Under the hood](https://docs.frak.id/wallet-sdk/under-the-hood).

## Setup

Add the following script tag to your HTML file:

```html
<script type="module" src="https://cdn.jsdelivr.net/npm/@frak-labs/components" defer="defer"></script>
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

## Sample usage for Share button

Sample code to use share button:

```html
<frak-button-share></frak-button-share>
```

Button with custom text:

```html
<frak-button-share text="Share and earn!"></frak-button-share>
```

Button with custom class:

```html
<frak-button-share classname="button button-primary"></frak-button-share>
```

## Sample usage for Wallet button

Sample code to use wallet button:

```html
<frak-button-wallet></frak-button-wallet>
```

Button with custom class:

```html
<frak-button-wallet classname="button button-primary"></frak-button-wallet>
```

## Sample usage for Open In App button

Sample code to use open in app button:

```html
<frak-open-in-app></frak-open-in-app>
```

Button with custom text:

```html
<frak-open-in-app text="Get the App"></frak-open-in-app>
```

Button with custom class:

```html
<frak-open-in-app classname="button button-primary"></frak-open-in-app>
```

**Note:** This component only renders on mobile devices. On desktop, it returns null.

## Sample usage for Post Purchase

Rendered on the order-confirmation page, it tracks the purchase and offers the buyer the sharing page:

```html
<frak-post-purchase customer-id="1234" order-id="5678" token="checkout-token"></frak-post-purchase>
```

## Sample usage for Banner

A banner that switches between the referral and in-app-browser messages on its own:

```html
<frak-banner></frak-banner>
```

Banner with custom copy:

```html
<frak-banner referral-title="You were referred!" referral-cta="Claim"></frak-banner>
```
