import type { Lang } from "@/i18n";

export type PersonaId = "lea" | "chloe";

export type Persona = {
    id: PersonaId;
    firstName: string;
    lastName: string;
    /** Instagram handle, without the `@`. */
    handle: string;
    email: string;
    phone: string;
    address: { line: string; city: string };
    card: { brand: "Visa" | "Mastercard"; last4: string };
    role: Record<Lang, string>;
    /** Avatar art: background + skin + hair tones. */
    look: { background: string; skin: string; hair: string };
};

export const personas: Record<PersonaId, Persona> = {
    lea: {
        id: "lea",
        firstName: "Léa",
        lastName: "Martin",
        handle: "lea.mrtn",
        email: "lea.martin@icloud.com",
        phone: "+33 6 12 48 90 31",
        address: { line: "12 rue des Martyrs", city: "75009 Paris" },
        card: { brand: "Visa", last4: "4821" },
        role: { fr: "La marraine", en: "The referrer" },
        look: { background: "#f3c9a8", skin: "#e8b48f", hair: "#5a3420" },
    },
    chloe: {
        id: "chloe",
        firstName: "Chloé",
        lastName: "Bernard",
        handle: "chloe.brnd",
        email: "chloe.bernard@gmail.com",
        phone: "+33 7 81 22 63 05",
        address: { line: "8 quai Saint-Vincent", city: "69001 Lyon" },
        card: { brand: "Mastercard", last4: "1937" },
        role: { fr: "La filleule", en: "The referee" },
        look: { background: "#c9d8f0", skin: "#c98d6b", hair: "#1e1714" },
    },
};

export function fullName(persona: Persona): string {
    return `${persona.firstName} ${persona.lastName}`;
}
