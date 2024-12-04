/* This file is auto-generated by SST. Do not edit. */
/* tslint:disable */
/* eslint-disable */
/* deno-fmt-ignore-file */
import "sst"
export {}
declare module "sst" {
  export interface Resource {
    "ALCHEMY_API_KEY": {
      "type": "sst.sst.Secret"
      "value": string
    }
    "Dashboard": {
      "type": "sst.aws.Nextjs"
      "url": string
    }
    "Elysia": {
      "service": string
      "type": "sst.aws.Service"
    }
    "FUNDING_ON_RAMP_URL": {
      "type": "sst.sst.Secret"
      "value": string
    }
    "MONGODB_BUSINESS_URI": {
      "type": "sst.sst.Secret"
      "value": string
    }
    "MasterVpc": {
      "bastion": string
      "type": "sst.aws.Vpc"
    }
    "NEXUS_RPC_SECRET": {
      "type": "sst.sst.Secret"
      "value": string
    }
    "NewsInteractionDemo": {
      "type": "sst.aws.StaticSite"
      "url": string
    }
    "PIMLICO_API_KEY": {
      "type": "sst.sst.Secret"
      "value": string
    }
    "POSTGRES_HOST": {
      "type": "sst.sst.Secret"
      "value": string
    }
    "POSTGRES_PASSWORD": {
      "type": "sst.sst.Secret"
      "value": string
    }
    "PRIVY_APP_ID": {
      "type": "sst.sst.Secret"
      "value": string
    }
    "SESSION_ENCRYPTION_KEY": {
      "type": "sst.sst.Secret"
      "value": string
    }
    "UMAMI_WALLET_WEBSITE_ID": {
      "type": "sst.sst.Secret"
      "value": string
    }
    "VAPID_PUBLIC_KEY": {
      "type": "sst.sst.Secret"
      "value": string
    }
    "VanillaJsDemo": {
      "type": "sst.aws.StaticSite"
      "url": string
    }
    "Wallet": {
      "type": "sst.aws.StaticSite"
      "url": string
    }
    "WalletExampleEthCC": {
      "type": "sst.aws.StaticSite"
      "url": string
    }
  }
}
