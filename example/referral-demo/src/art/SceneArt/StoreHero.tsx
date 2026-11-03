import { CastShadowFilter, useSvgId } from "../components/svg";
import { PlacedProduct } from "../products";

type Plinth = {
    x: number;
    width: number;
    top: number;
    bottom: number;
    round: boolean;
};

const PLINTHS: readonly Plinth[] = [
    { x: 168, width: 92, top: 262, bottom: 384, round: true },
    { x: 48, width: 118, top: 336, bottom: 412, round: false },
    { x: 254, width: 112, top: 368, bottom: 428, round: true },
];

function PlinthShape({ plinth, id }: { plinth: Plinth; id: string }) {
    const { x, width, top, bottom, round } = plinth;
    const rx = width / 2;
    if (round) {
        return (
            <g>
                <path
                    d={`M${x} ${top}V${bottom}a${rx} 7 0 0 0 ${width} 0V${top}Z`}
                    fill={`url(#${id}p)`}
                />
                <ellipse cx={x + rx} cy={top} rx={rx} ry="7" fill="#f6eee4" />
            </g>
        );
    }
    return (
        <g>
            <rect
                x={x}
                y={top}
                width={width}
                height={bottom - top}
                fill={`url(#${id}p)`}
            />
            <path d={`M${x} ${top}l10-9h${width}l-10 9Z`} fill="#f6eee4" />
            <path
                d={`M${x + width} ${top}l10-9v${bottom - top - 9}l-10 9Z`}
                fill="#c9b49c"
            />
        </g>
    );
}

function Arrangement({ id }: { id: string }) {
    return (
        <>
            {PLINTHS.map((plinth) => (
                <PlinthShape key={plinth.x} plinth={plinth} id={id} />
            ))}
            <PlacedProduct productId="cleanser" x={214} y={262} scale={0.5} />
            <PlacedProduct productId="cream" x={94} y={334} scale={0.48} />
            <PlacedProduct productId="balm" x={145} y={334} scale={0.42} />
            <PlacedProduct productId="serum" x={292} y={367} scale={0.5} />
            <PlacedProduct productId="mask" x={340} y={368} scale={0.34} />
        </>
    );
}

/** The product line on plaster plinths under warm raking light from the left. */
export function StoreHero() {
    const id = useSvgId();
    return (
        <>
            <defs>
                <linearGradient id={`${id}w`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor="#e6d5c0" />
                    <stop offset="0.7" stopColor="#dfcab1" />
                    <stop offset="0.72" stopColor="#ead9c4" />
                    <stop offset="1" stopColor="#d9c2a6" />
                </linearGradient>
                <linearGradient id={`${id}n`} x1="0" x2="1">
                    <stop offset="0" stopColor="#bfa486" />
                    <stop offset="0.22" stopColor="#d6c0a6" />
                    <stop offset="1" stopColor="#e0cdb6" />
                </linearGradient>
                <linearGradient id={`${id}p`} x1="0" x2="1">
                    <stop offset="0" stopColor="#f5ede3" />
                    <stop offset="0.45" stopColor="#ebdfd0" />
                    <stop offset="1" stopColor="#c6b096" />
                </linearGradient>
                <linearGradient
                    id={`${id}l`}
                    gradientUnits="userSpaceOnUse"
                    x1="45"
                    y1="210"
                    x2="261"
                    y2="92"
                >
                    <stop offset="0" stopColor="#fff9ee" stopOpacity="0" />
                    <stop offset="0.35" stopColor="#fff9ee" stopOpacity="0.6" />
                    <stop offset="0.65" stopColor="#fff9ee" stopOpacity="0.6" />
                    <stop offset="1" stopColor="#fff9ee" stopOpacity="0" />
                </linearGradient>
                <radialGradient id={`${id}g`} cx="0.2" cy="0.1" r="0.9">
                    <stop offset="0" stopColor="#ffd6a0" stopOpacity="0.25" />
                    <stop offset="1" stopColor="#ffd6a0" stopOpacity="0" />
                </radialGradient>
                <CastShadowFilter id={`${id}s`} blur={7} opacity={0.22} />
            </defs>
            <rect width="400" height="500" fill={`url(#${id}w)`} />
            <path
                d="M150 362V190a96 96 0 0 1 192 0v172Z"
                fill={`url(#${id}n)`}
            />
            <path d="M-80 -20h250L520 520H210Z" fill={`url(#${id}l)`} />
            <g filter={`url(#${id}s)`} transform="translate(40 -10)">
                <Arrangement id={id} />
            </g>
            <Arrangement id={id} />
            <rect width="400" height="500" fill={`url(#${id}g)`} />
        </>
    );
}
