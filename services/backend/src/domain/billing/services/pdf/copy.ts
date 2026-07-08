/**
 * Frak's own invoicing identity, printed as the "seller" block on every
 * generated deposit/withdraw document. Hardcoded for Phase 2 — becomes a
 * config value if Frak's legal entity ever needs to vary per stage/country.
 */
export const FRAK_SELLER = {
    companyName: "Frak Labs",
    siren: "953585783",
    vatNumber: "FR90953585783",
    addressLines: ["40 rue Bezout", "75014 Paris, France"],
    email: "hello@frak-labs.com",
    /** Legal-form mention printed in the footer of every issued document. */
    legalForm: "Société par actions simplifiée au capital social de 4 296,00 €",
} as const;

/**
 * Deposit-note copy. The document is an attestation that Frak received an
 * advance on advertising budget credited to the advertiser's campaign wallet —
 * explicitly NOT an invoice.
 */
export const DEPOSIT_OBJET =
    "Alimentation du wallet maître Frak à utiliser pour les campagnes de récompenses client";
export const DEPOSIT_ATTESTATION = [
    "Ce document atteste que Frak Labs a bien reçu les fonds mentionnés ci-dessus pour être crédités sur le wallet de campagne de l'annonceur.",
    "Ce crédit constitue une avance sur budget publicitaire, à consommer au fil des campagnes actives, et ne constitue pas une facture.",
];

/**
 * Withdraw-note copy. Symmetric to the deposit note: an attestation that Frak
 * returned the unconsumed advance to the advertiser — also NOT an invoice.
 */
export const WITHDRAW_OBJET =
    "Restitution des fonds non consommés du wallet de campagne Frak";
export const WITHDRAW_ATTESTATION = [
    "Ce document atteste que Frak Labs a restitué à l'annonceur les fonds non consommés mentionnés ci-dessus, initialement crédités sur son wallet de campagne.",
    "Ce remboursement correspond au solde d'avance sur budget publicitaire non consommé, et ne constitue pas une facture.",
];
