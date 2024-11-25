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
    "PIMLICO_API_KEY": {
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
  }
}
