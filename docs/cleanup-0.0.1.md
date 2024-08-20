# CleanUp v0.0.1

First big cleanup before going prod yeaay

Just before the big cleanup, we pushed the tag: `@frak-labs/wallet@0.0.1`

Three major stuff we will delete:

## MultiChain

The wallet won't be multi chain after this cleanup, the chain will depend on the environment

And so, the var `frakChainId` and `frakChainPocClient` won't be needed anymore (as peer to custom chain switch logic on the wagmi provider side)

This changes also remove the multi chain recovery options.

Multi chain could be bring back when wallet authentication could be change to a keystore rollup for example

## Paywall

All the paywall related feature will be removed.

Since the SDK now expose popup to send transaction on the behalf of the end users, all the complexe paywall logic will be removed and can be replaced by the useDisplayModal hook with the custom transaction you want to do.

Some logic can be reused in the future (for example the listener on the paywall unlock status, could be switched to a listener on a user interaction or a user operation)

So 2 SDK endpoint will be removed (`watchUnlockStatus` + `getUnlockOptions`), and so their implementation on the Nexus side + the example website showcasing them (previously at `news-example.frak.id`)

## Community Token

Community Token where just a draft of the future Members space coming up

It was just a 721A token with an NFT per company, and using the alchemy nft api to fetch the balance

Metadata was hardcoded (will be moved to an ipfs if we redo this)