import clsx from "clsx";
import { avatarSizes } from "./avatar.css";

type AvatarSize = "s" | "m";

type AvatarProps = {
    name: string;
    size?: AvatarSize;
    className?: string;
};

function initialsOf(name: string): string {
    const words = name.trim().split(/\s+/).filter(Boolean);
    if (words.length >= 2) {
        return `${words[0][0]}${words[1][0]}`.toUpperCase();
    }
    return name.trim().slice(0, 2).toUpperCase();
}

export function Avatar({ name, size = "m", className }: AvatarProps) {
    return (
        <span className={clsx(avatarSizes[size], className)} aria-hidden="true">
            {initialsOf(name)}
        </span>
    );
}
