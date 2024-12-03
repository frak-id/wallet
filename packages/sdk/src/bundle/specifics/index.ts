import { moov360 } from "./moov360";

export function websiteOverrides() {
    switch (window.location.host) {
        case "moov360.com":
            moov360();
            break;
    }
}
