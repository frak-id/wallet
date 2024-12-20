interface RouletteOptions {
    spacing?: number;
    acceleration?: number;
    fps?: number;
    audio?: string | HTMLAudioElement;
    selector?: string;
    stopCallback?: (event: CustomEvent) => void;
    startCallback?: (event: CustomEvent) => void;
}

interface PrizeOptions {
    index?: number;
    element?: HTMLElement;
}

const rotationStopEventName = "rotationStop";
const rotationStartEventName = "rotationStart";
const rouletteClass = "roulette";
const rouletteListClass = "roulette__list";
const roulettePrizeClass = "roulette__prize";

const PrizeNotFoundException = "Prize not found";
const ItemsNotFoundException = "Items not found";
const NotImplementedException = "Not implemented";
const NotEnoughArgumentsException = "Not enough arguments";
const ContainerUndefinedException = "Container was undefined";
const RotationIsAlreadyActiveException = "Rotation is already active";

const rotationTokens = new WeakMap<Roulette, number>();

class Prize {
    index: number;
    element: HTMLElement;
    wrapper: HTMLLIElement;

    constructor(
        element: HTMLElement,
        index: number,
        spacing: number,
        width: number,
        height: number
    ) {
        this.index = index;
        this.element = element;

        const wrapper = document.createElement("li");
        wrapper.classList.add(roulettePrizeClass);
        wrapper.style.marginRight = `${spacing}px`;
        wrapper.style.minWidth = `${width}px`;
        wrapper.style.minHeight = `${height}px`;
        wrapper.appendChild(element);

        this.wrapper = wrapper;
    }
}

export class Roulette {
    private container: HTMLElement;
    private list: HTMLUListElement;
    private prizes: Prize[];
    private spacing: number;
    private acceleration: number;
    private width: number;
    private prizeWidth: number;
    private audio: HTMLAudioElement | null;
    private fps: number;

    constructor(
        container: string | HTMLElement | [HTMLElement],
        options?: RouletteOptions
    ) {
        const {
            spacing = 10,
            acceleration = 350,
            fps = 40,
            audio = "libs/vanillaRoulette/click.wav",
            selector = ":scope > *",
            stopCallback = null,
            startCallback = null,
        } = options || {};

        const node =
            typeof container === "string"
                ? document.querySelector(container)
                : container instanceof HTMLElement
                  ? container
                  : container && container[0] instanceof HTMLElement
                    ? container[0]
                    : undefined;

        if (!node) throw ContainerUndefinedException;

        node.classList.add(rouletteClass);

        const list = document.createElement("ul");
        list.classList.add(rouletteListClass);

        const childNodes = [
            ...node.querySelectorAll(selector),
        ] as HTMLElement[];
        if (!childNodes.length) throw ItemsNotFoundException;
        const injector = childNodes[0].parentElement!;
        const maxWidth = Math.max(...childNodes.map((x) => x.clientWidth));
        const maxHeight = Math.max(...childNodes.map((x) => x.clientHeight));
        const prizes = childNodes.map(
            (el, i) => new Prize(el, i, spacing, maxWidth, maxHeight)
        );
        for (const prize of prizes) list.appendChild(prize.wrapper);

        node.style.padding = `${spacing}px`;
        injector.appendChild(list);

        const player =
            typeof audio === "string"
                ? new Audio(audio)
                : audio && (audio as HTMLAudioElement).play
                  ? (audio as HTMLAudioElement)
                  : null;

        if (player && !(player as any).clone)
            (player as any).clone = player.cloneNode
                ? player.cloneNode.bind(player)
                : () => player;

        this.container = node;
        this.list = list;
        this.prizes = prizes;
        this.spacing = spacing;
        this.acceleration = acceleration;
        this.width = (spacing + maxWidth) * prizes.length;
        this.prizeWidth = maxWidth;
        this.audio = player;
        this.fps = fps;
        rotationTokens.set(this, -1);

        if (startCallback)
            this.container.addEventListener(
                rotationStartEventName,
                startCallback as EventListener
            );
        if (stopCallback)
            this.container.addEventListener(
                rotationStopEventName,
                stopCallback as EventListener
            );
    }

    rotate(pixels = 0): void {
        if (this.rotates) throw RotationIsAlreadyActiveException;
        if (pixels > 0) rotateForward.bind(this)(pixels);
        else if (pixels < 0) rotateBackward.bind(this)(pixels);
    }

    rotateTo(
        block: number | HTMLElement,
        options?: {
            tracks?: number;
            time?: number;
            random?: boolean;
            backward?: boolean;
        }
    ): void {
        if (this.rotates) throw RotationIsAlreadyActiveException;
        const numBlock = Number(block);
        const prize = Number.isNaN(numBlock)
            ? this.findPrize({ element: block as HTMLElement })
            : this.findPrize({ index: numBlock });
        if (!prize) throw PrizeNotFoundException;

        let {
            tracks = 0,
            time = 0,
            random = true,
            backward = false,
        } = options || {};

        time |= 0;
        tracks |= 0;

        if (this.selectedPrize.index === prize.index && !time && !tracks)
            return;
        if (time) rotateByTime.bind(this)(prize, time, random, backward);
        else rotateByTracks.bind(this)(prize, tracks, random, backward);
    }

    playClick(): void {
        if (this.audio) {
            const promise = (this.audio as any).clone().play();
            if (promise && promise.catch) promise.catch(() => {});
        }
    }

    findPrize(options: PrizeOptions): Prize | undefined {
        const { index, element } = options || {};
        if ((typeof index !== "number" || Number.isNaN(index)) && !element)
            throw NotEnoughArgumentsException;
        return element
            ? this.prizes.find((x) => x.element === element)
            : this.prizes[index!];
    }

    stop(): void {
        if (this.rotates) {
            clearInterval(rotationTokens.get(this));
            rotationTokens.set(this, -1);
            this.container.dispatchEvent(
                new CustomEvent(rotationStopEventName, {
                    detail: { prize: this.selectedPrize },
                })
            );
        }
    }

    get selectedPrize(): Prize {
        const center = this.center;
        const firstBlockMargin = Number(
            this.firstBlock.wrapper.style.marginLeft.replace("px", "") || 0
        );

        // Find the prize whose center is closest to the roulette's center
        return this.prizes.concat().sort((a, b) => {
            const aCenter =
                a.wrapper.offsetLeft + this.prizeWidth / 2 + firstBlockMargin;
            const bCenter =
                b.wrapper.offsetLeft + this.prizeWidth / 2 + firstBlockMargin;
            return Math.abs(aCenter - center) - Math.abs(bCenter - center);
        })[0];
    }
    // get selectedPrize(): Prize {
    //     const afterCenterIndex = this.prizes
    //         .concat()
    //         .sort((a, b) => a.wrapper.offsetLeft - b.wrapper.offsetLeft)
    //         .find((prize) => prize.wrapper.offsetLeft > this.center)!.index;
    //     return this.prizes[
    //         (this.prizes.length + afterCenterIndex - 1) % this.prizes.length
    //     ];
    // }

    get firstBlock(): Prize {
        return this.findPrize({
            element: this.list.querySelector(
                `:scope > .${roulettePrizeClass} > *`
            ) as HTMLElement,
        })!;
    }

    get lastBlock(): Prize {
        const nodes = this.list.querySelectorAll(
            `:scope > .${roulettePrizeClass} > *`
        );
        return this.findPrize({
            element: nodes[nodes.length - 1] as HTMLElement,
        })!;
    }

    get rotates(): boolean {
        return rotationTokens.get(this) > -1;
    }

    get center(): number {
        return this.list.offsetLeft + this.list.clientWidth / 2;
    }

    static get version(): string {
        return "1.1.0";
    }
}

function rotateForward(this: Roulette, pixels: number): void {
    this.container.dispatchEvent(
        new CustomEvent(rotationStartEventName, {
            detail: { prize: this.selectedPrize },
        })
    );

    pixels = Math.abs(pixels);
    const starter = Math.abs(
        Number(this.firstBlock.wrapper.style.marginLeft.replace("px", ""))
    );

    const k = this.acceleration;
    const v0 = Math.sqrt(2 * k * pixels);
    const totalTime = v0 / k;

    const intervalMS = 1000 / this.fps;
    const intervalS = intervalMS / 1000;

    const blockWidth = this.prizeWidth + this.spacing;
    let t = 0;
    let currentBlock = 0;
    let played = false;
    const halfBlock = this.spacing + this.prizeWidth / 2;
    let lastPos = starter;

    const token = setInterval(() => {
        // Add small buffer to ensure we reach exactly totalTime
        if (t >= totalTime - intervalS / 2) {
            // Ensure final position is exact
            const finalPos = (starter + pixels) % this.width;
            const finalMargin = finalPos % blockWidth;
            this.firstBlock.wrapper.style.marginLeft = `-${finalMargin}px`;
            this.stop();
            return;
        }

        const currentPos = (starter + (v0 * t - (k * t * t) / 2)) % this.width;

        if (Math.floor(currentPos / blockWidth) != currentBlock) {
            const block = this.firstBlock;
            this.list.appendChild(block.wrapper);
            block.wrapper.style.marginLeft = "0px";
            currentBlock = (currentBlock + 1) % this.prizes.length;
            played = false;
        }

        const margin = currentPos % blockWidth;
        this.firstBlock.wrapper.style.marginLeft = `-${margin}px`;

        if (margin > halfBlock && !played) {
            played = true;
            this.playClick();
        }

        lastPos = currentPos;
        t += intervalS;
    }, intervalMS);

    rotationTokens.set(this, token);
}

// function rotateForward(this: Roulette, pixels: number): void {
//     this.container.dispatchEvent(
//         new CustomEvent(rotationStartEventName, {
//             detail: { prize: this.selectedPrize },
//         })
//     );

//     pixels = Math.abs(pixels);
//     const starter = Math.abs(
//         Number(this.firstBlock.wrapper.style.marginLeft.replace("px", ""))
//     );

//     const k = this.acceleration;
//     const v0 = Math.sqrt(2 * k * pixels);
//     const totalTime = v0 / k;

//     const intervalMS = 1000 / this.fps;
//     const intervalS = intervalMS / 1000;

//     const blockWidth = this.prizeWidth + this.spacing;
//     let t = 0;
//     let currentBlock = 0;
//     let played = false;
//     const halfBlock = this.spacing + this.prizeWidth / 2;

//     const token = setInterval(() => {
//         if (t > totalTime) {
//             this.stop();
//             return;
//         }

//         const currentPos = (starter + (v0 * t - (k * t * t) / 2)) % this.width;

//         if (Math.floor(currentPos / blockWidth) != currentBlock) {
//             const block = this.firstBlock;
//             this.list.appendChild(block.wrapper);
//             block.wrapper.style.marginLeft = "0px";
//             currentBlock = (currentBlock + 1) % this.prizes.length;
//             played = false;
//         }
//         const margin = currentPos % blockWidth;
//         this.firstBlock.wrapper.style.marginLeft = `-${margin}px`;
//         if (margin > halfBlock && !played) {
//             played = true;
//             this.playClick();
//         }

//         t += intervalS;
//     }, intervalMS);

//     rotationTokens.set(this, token);
// }

function rotateBackward(this: Roulette, pixels: number): void {
    throw NotImplementedException;
}

function rotateByTracks(
    this: Roulette,
    prize: Prize,
    tracks: number,
    random: boolean,
    backward: boolean
): void {
    const blockWidth = this.prizeWidth + this.spacing;
    const currentBlock = this.selectedPrize;
    let length = Math.round(tracks) * this.width;
    if (backward) {
        length *= -1;
    } else {
        const currentPosition =
            currentBlock.index * blockWidth +
            (this.center - currentBlock.wrapper.offsetLeft);
        const destination =
            prize.index * blockWidth + this.spacing + this.prizeWidth / 2;
        if (destination < currentPosition)
            length += this.width - (currentPosition - destination);
        else length += destination - currentPosition;
        if (random)
            length +=
                Math.random() * this.prizeWidth * 0.8 - this.prizeWidth * 0.4;
    }
    this.rotate(length);
}

function rotateByTime(
    this: Roulette,
    prize: Prize,
    time: number,
    random: boolean,
    backward: boolean
): void {
    const v0 = this.acceleration * time;
    const l = (v0 * v0) / (2 * this.acceleration);
    const tracks = Math.ceil(l / this.width);
    rotateByTracks.bind(this)(prize, tracks, random, backward);
}

// const Roulette = (() => {
//     const rotationStopEventName = "rotationStop";
//     const rotationStartEventName = "rotationStart";

//     const rouletteClass = "roulette";
//     const rouletteListClass = "roulette__list";
//     const roulettePrizeClass = "roulette__prize";

//     const PrizeNotFoundException = "Prize not found";
//     const ItemsNotFoundException = "Items not found";
//     const NotImplementedException = "Not implemented";
//     const NotEnoughArgumentsException = "Not enough arguments";
//     const ContainerUndefinedException = "Container was undefined";
//     const RotationIsAlreadyActiveException = "Rotation is already active";

//     const rotationTokens = new WeakMap();

//     class Prize {
//         constructor(element, index, spacing, width, height) {
//             this.index = index;
//             this.element = element;

//             const wrapper = document.createElement("li");
//             wrapper.classList.add(roulettePrizeClass);
//             wrapper.style.marginRight = `${spacing}px`;
//             wrapper.style.minWidth = `${width}px`;
//             wrapper.style.minHeight = `${height}px`;
//             wrapper.appendChild(element);

//             this.wrapper = wrapper;
//         }
//     }

//     class Roulette {
//         constructor(container, options) {
//             const {
//                 spacing = 10,
//                 acceleration = 350,
//                 fps = 40,
//                 audio = "libs/vanillaRoulette/click.wav",
//                 selector = ":scope > *",
//                 stopCallback = null,
//                 startCallback = null,
//             } = options || {};

//             const node =
//                 typeof container === "string"
//                     ? document.querySelector(container)
//                     : container instanceof HTMLElement
//                       ? container
//                       : container && container[0] instanceof HTMLElement
//                         ? container[0]
//                         : undefined;

//             if (!node) throw ContainerUndefinedException;

//             node.classList.add(rouletteClass);

//             const list = document.createElement("ul");
//             list.classList.add(rouletteListClass);

//             const childNodes = [...node.querySelectorAll(selector)];
//             if (!childNodes.length) throw ItemsNotFoundException;
//             const injector = childNodes[0].parentElement;
//             const maxWidth = Math.max(...childNodes.map((x) => x.clientWidth));
//             const maxHeight = Math.max(
//                 ...childNodes.map((x) => x.clientHeight)
//             );
//             const prizes = childNodes.map(
//                 (el, i) => new Prize(el, i, spacing, maxWidth, maxHeight)
//             );
//             for (const prize of prizes) list.appendChild(prize.wrapper);

//             node.style.padding = `${spacing}px`;
//             injector.appendChild(list);

//             const player =
//                 typeof audio === "string"
//                     ? new Audio(audio)
//                     : audio && audio.play
//                       ? audio
//                       : null;
//             if (player && !player.clone)
//                 player.clone = player.cloneNode
//                     ? player.cloneNode
//                     : () => player;

//             this.container = node;
//             this.list = list;
//             this.prizes = prizes;
//             this.spacing = spacing;
//             this.acceleration = acceleration;
//             this.width = (spacing + maxWidth) * prizes.length;
//             this.prizeWidth = maxWidth;
//             this.audio = player;
//             this.fps = fps;
//             rotationTokens.set(this, -1);

//             if (startCallback)
//                 this.container.addEventListener(
//                     rotationStartEventName,
//                     startCallback
//                 );
//             if (stopCallback)
//                 this.container.addEventListener(
//                     rotationStopEventName,
//                     stopCallback
//                 );
//         }

//         rotate(pixels = 0) {
//             if (this.rotates) throw RotationIsAlreadyActiveException;
//             if (pixels > 0) rotateForward.bind(this)(pixels);
//             else if (pixels < 0) rotateBackward.bind(this)(pixels);
//         }

//         rotateTo(block, options) {
//             if (this.rotates) throw RotationIsAlreadyActiveException;
//             const numBlock = Number(block);
//             const prize = Number.isNaN(numBlock)
//                 ? this.findPrize({ element: block })
//                 : this.findPrize({ index: numBlock });
//             if (!prize) throw PrizeNotFoundException;
//             let {
//                 tracks = 0,
//                 time = 0,
//                 random = true,
//                 backward = false,
//             } = options || {};
//             time |= 0;
//             tracks |= 0;
//             if (this.selectedPrize.index === prize.index && !time && !tracks)
//                 return;
//             if (time) rotateByTime.bind(this)(prize, time, random, backward);
//             else rotateByTracks.bind(this)(prize, tracks, random, backward);
//         }

//         playClick() {
//             if (this.audio) {
//                 const promise = this.audio.clone().play();
//                 if (promise && promise.catch) promise.catch(() => {});
//             }
//         }

//         findPrize(options) {
//             const { index, element } = options || {};
//             if ((typeof index !== "number" || Number.isNaN(index)) && !element)
//                 throw NotEnoughArgumentsException;
//             return element
//                 ? this.prizes.find((x) => x.element === element)
//                 : this.prizes[index];
//         }

//         stop() {
//             if (this.rotates) {
//                 clearInterval(rotationTokens.get(this));
//                 rotationTokens.set(this, -1);
//                 this.container.dispatchEvent(
//                     new CustomEvent(rotationStopEventName, {
//                         detail: { prize: this.selectedPrize },
//                     })
//                 );
//             }
//         }

//         get selectedPrize() {
//             const afterCenterIndex = this.prizes
//                 .concat()
//                 .sort((a, b) => a.wrapper.offsetLeft - b.wrapper.offsetLeft)
//                 .find((prize) => prize.wrapper.offsetLeft > this.center).index;
//             return this.prizes[
//                 (this.prizes.length + afterCenterIndex - 1) % this.prizes.length
//             ];
//         }

//         get firstBlock() {
//             return this.findPrize({
//                 element: this.list.querySelector(
//                     `:scope > .${roulettePrizeClass} > *`
//                 ),
//             });
//         }

//         get lastBlock() {
//             const nodes = this.list.querySelectorAll(
//                 `:scope > .${roulettePrizeClass} > *`
//             );
//             return this.findPrize({ element: nodes[nodes.length - 1] });
//         }

//         get rotates() {
//             return rotationTokens.get(this) > -1;
//         }

//         get center() {
//             return this.list.offsetLeft + this.list.clientWidth / 2;
//         }

//         static get version() {
//             return "1.1.0";
//         }
//     }

//     function rotateForward(pixels) {
//         this.container.dispatchEvent(
//             new CustomEvent(rotationStartEventName, {
//                 detail: { prize: this.selectedPrize },
//             })
//         );

//         pixels = Math.abs(pixels);
//         const starter = Math.abs(
//             Number(this.firstBlock.wrapper.style.marginLeft.replace("px", ""))
//         );

//         const k = this.acceleration;
//         const v0 = Math.sqrt(2 * k * pixels);
//         const totalTime = v0 / k;

//         const intervalMS = 1000 / this.fps;
//         const intervalS = intervalMS / 1000;

//         const blockWidth = this.prizeWidth + this.spacing;
//         let t = 0;
//         let currentBlock = 0;
//         let played = false;
//         const halfBlock = this.spacing + this.prizeWidth / 2;

//         const token = setInterval(() => {
//             if (t > totalTime) {
//                 this.stop();
//                 return;
//             }

//             const currentPos =
//                 (starter + (v0 * t - (k * t * t) / 2)) % this.width;

//             if (Math.floor(currentPos / blockWidth) != currentBlock) {
//                 const block = this.firstBlock;
//                 this.list.appendChild(block.wrapper);
//                 block.wrapper.style.marginLeft = "0px";
//                 currentBlock = (currentBlock + 1) % this.prizes.length;
//                 played = false;
//             }
//             const margin = currentPos % blockWidth;
//             this.firstBlock.wrapper.style.marginLeft = `-${margin}px`;
//             if (margin > halfBlock && !played) {
//                 played = true;
//                 this.playClick();
//             }

//             t += intervalS;
//         }, intervalMS);

//         rotationTokens.set(this, token);
//     }

//     function rotateBackward(pixels) {
//         // TODO
//         throw NotImplementedException;
//     }

//     function rotateByTracks(prize, tracks, random, backward) {
//         const blockWidth = this.prizeWidth + this.spacing;
//         const currentBlock = this.selectedPrize;
//         let length = Math.round(tracks) * this.width;
//         if (backward) {
//             // TODO
//             length *= -1;
//         } else {
//             const currentPosition =
//                 currentBlock.index * blockWidth +
//                 (this.center - currentBlock.wrapper.offsetLeft);
//             const destination =
//                 prize.index * blockWidth + this.spacing + this.prizeWidth / 2;
//             if (destination < currentPosition)
//                 length += this.width - (currentPosition - destination);
//             else length += destination - currentPosition;
//             if (random)
//                 length +=
//                     Math.random() * this.prizeWidth * 0.8 -
//                     this.prizeWidth * 0.4;
//         }
//         this.rotate(length);
//     }

//     function rotateByTime(prize, time, random, backward) {
//         const v0 = this.acceleration * time;
//         const l = (v0 * v0) / (2 * this.acceleration);
//         const tracks = Math.ceil(l / this.width);
//         rotateByTracks.bind(this)(prize, tracks, random, backward);
//     }

//     return Roulette;
// })();
