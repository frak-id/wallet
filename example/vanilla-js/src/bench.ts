import { MsgPackDecoderFast, MsgPackEncoder, MsgPackEncoderFast } from "@jsonjoy.com/json-pack/lib/msgpack";
import { JsonDecoder, JsonEncoderStable } from "@jsonjoy.com/json-pack/lib/json";
import { Writer } from "@jsonjoy.com/util/lib/buffers/Writer";
import { sha256 as jsSha256 } from "js-sha256";
import { keccak256 as viemKeccak256, sha256 as viemSha256 } from "viem";
import { keccak256, shake128 } from "js-sha3";

// The payload we will test
const payload = {
    productId: "0xF002C28AEEa942B72f5bAAd95748F78104f91fc6",
    type: {
        props: {
            prop1: "test",
            prop2: "abcdefghijklmnopqrstuvwxyz",
            prop3: "1234657890",
            prop4: "1234567890",
            prop5: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Phasellus at arcu neque. Etiam ornare magna ac tortor ultricies pretium. Cras sodales enim eu sapien eleifend consectetur. Etiam rhoncus rhoncus sapien, vitae malesuada enim porttitor rhoncus. Integer velit ante, pellentesque non erat eu, lacinia iaculis enim. Fusce sed lectus et ante semper elementum. Morbi euismod bibendum malesuada. Curabitur pellentesque dolor ac blandit tempor. Aenean eget lobortis mi. Quisque erat mi, aliquam nec odio vitae, tempus tempus ante. Ut pretium metus a mi mollis mollis. Pellentesque malesuada metus eget nibh eleifend porta. Donec faucibus lectus sit amet ex lacinia lobortis. Integer vehicula tellus in mollis auctor. Aliquam nec felis leo.",
        },
        var: [
            "123456789",
            "123456789n",
            123456789,
            true,
            false,
            null,
            undefined,
            {
                id: "test",
                msg: "test"
            }
        ]
    }
}

type Stats = {
    size: number;
    encodeTime: number;
    decodeTime: number;
}

// Run 100k times
const runs = 100_000;

// msg packer at 0.0016ms encoded - 0.0040ms decoded
function benchMsgPackerFast() {
    // Try the json joy encoding against this payload, in a browser tab
    const encoder = new MsgPackEncoderFast();
    const decoder = new MsgPackDecoderFast();
    const encoded = encoder.encode(payload);

    const stats: Stats = {
        size: encoded.length,
        encodeTime: 0,
        decodeTime: 0
    }

    for (let i = 0; i < runs; i++) {
        const start = performance.now();
        encoder.encode(payload);
        const end = performance.now();
        stats.encodeTime += end - start;
    
        const start2 = performance.now();
        decoder.decode(encoded);
        const end2 = performance.now();
        stats.decodeTime += end2 - start2;
    }
    
    const avgEncodeTime = stats.encodeTime / runs;
    const avgDecodeTime = stats.decodeTime / runs;
    console.log("MsgPackerFast:")
    console.log(`Size: ${stats.size} bytes`);
    console.log(`Average encode time: ${avgEncodeTime}ms`);
    console.log(`Average decode time: ${avgDecodeTime}ms`);
    return stats;
}


// msg packer at 0.0015ms encoded - 0.0040ms decoded
function benchMsgPacker() {
    // Try the json joy encoding against this payload, in a browser tab
    const encoder = new MsgPackEncoder();
    const decoder = new MsgPackDecoderFast();
    const encoded = encoder.encode(payload);

    const stats: Stats = {
        size: encoded.length,
        encodeTime: 0,
        decodeTime: 0
    }

    for (let i = 0; i < runs; i++) {
        const start = performance.now();
        encoder.encode(payload);
        const end = performance.now();
        stats.encodeTime += end - start;
    
        const start2 = performance.now();
        decoder.decode(encoded);
        const end2 = performance.now();
        stats.decodeTime += end2 - start2;
    }
    
    const avgEncodeTime = stats.encodeTime / runs;
    const avgDecodeTime = stats.decodeTime / runs;
    console.log("MsgPacker:")
    console.log(`Size: ${stats.size} bytes`);
    console.log(`Average encode time: ${avgEncodeTime}ms`);
    console.log(`Average decode time: ${avgDecodeTime}ms`);
    return stats;
}

// json stringify at 0.0009ms encoded - 0.0011ms decoded
function benchJson() {
    // Try the json joy encoding against this payload, in a browser tab
    const encoded = JSON.stringify(payload);

    const stats: Stats = {
        size: encoded.length,
        encodeTime: 0,
        decodeTime: 0
    }

    for (let i = 0; i < runs; i++) {
        const start = performance.now();
        JSON.stringify(payload);
        const end = performance.now();
        stats.encodeTime += end - start;
    
        const start2 = performance.now();
        JSON.parse(encoded);
        const end2 = performance.now();
        stats.decodeTime += end2 - start2;
    }
    
    const avgEncodeTime = stats.encodeTime / runs;
    const avgDecodeTime = stats.decodeTime / runs;
    console.log("JSON.stringify:")
    console.log(`Size: ${stats.size} bytes`);
    console.log(`Average encode time: ${avgEncodeTime}ms`);
    console.log(`Average decode time: ${avgDecodeTime}ms`);
    return stats;
}

// json joy at 0.0026ms encoded - 0.0074ms decoded
function benchJsonJoy() {
    const writer = new Writer(128);
    // Try the json joy encoding against this payload, in a browser tab
    const encoder = new JsonEncoderStable(writer);
    const decoder = new JsonDecoder();
    const encoded = encoder.encode(payload);


    const stats: Stats = {
        size: encoded.length,
        encodeTime: 0,
        decodeTime: 0
    }

    for (let i = 0; i < runs; i++) {
        const start = performance.now();
        encoder.encode(payload);
        const end = performance.now();
        stats.encodeTime += end - start;
    
        const start2 = performance.now();
        decoder.decode(encoded);
        const end2 = performance.now();
        stats.decodeTime += end2 - start2;
    }
    
    const avgEncodeTime = stats.encodeTime / runs;
    const avgDecodeTime = stats.decodeTime / runs;
    console.log("JSON Joy json:")
    console.log(`Size: ${stats.size} bytes`);
    console.log(`Average encode time: ${avgEncodeTime}ms`);
    console.log(`Average decode time: ${avgDecodeTime}ms`);
    return stats;
}

// js-sha256 at 0.025ms avg
function benchJsSha256() {
    // Try the json joy encoding against this payload, in a browser tab
    const encoder = new MsgPackEncoder();
    const encoded = encoder.encode(payload);

    const stats: Stats = {
        size: encoded.length,
        encodeTime: 0,
        decodeTime: 0
    }
    
    for (let i = 0; i < runs; i++) {
        const start = performance.now();
        jsSha256(encoded);
        const end = performance.now();
        stats.encodeTime += end - start;
    }

    const avgEncodeTime = stats.encodeTime / runs;
    console.log("JS Sha256:")
    console.log(`Size: ${stats.size} bytes`);
    console.log(`Average encode time: ${avgEncodeTime}ms`);
    return stats;
}

// viem at 0.018ms avg 
function benchViemSha256() {
    // Try the json joy encoding against this payload, in a browser tab
    const encoder = new MsgPackEncoder();
    const encoded = encoder.encode(payload);
    const stats: Stats = {
        size: encoded.length,
        encodeTime: 0,
        decodeTime: 0
    }
    
    for (let i = 0; i < runs; i++) {
        const start = performance.now();
        viemSha256(encoded);
        const end = performance.now();
        stats.encodeTime += end - start;
    }

    const avgEncodeTime = stats.encodeTime / runs;
    console.log("Viem Sha256:")
    console.log(`Size: ${stats.size} bytes`);
    console.log(`Average encode time: ${avgEncodeTime}ms`);
    return stats;
}

// Native win (0.015ms avg)
async function benchNativeSha256() {
    // Try the json joy encoding against this payload, in a browser tab
    const encoder = new MsgPackEncoder();
    const encoded = encoder.encode(payload);
    const stats: Stats = {
        size: encoded.length,
        encodeTime: 0,
        decodeTime: 0
    }
    
    for (let i = 0; i < runs; i++) {
        const start = performance.now();
        await window.crypto.subtle.digest("SHA-256", encoded);
        const end = performance.now();
        stats.encodeTime += end - start;
    }

    const avgEncodeTime = stats.encodeTime / runs;
    console.log("window.crypto Sha256:")
    console.log(`Size: ${stats.size} bytes`);
    console.log(`Average encode time: ${avgEncodeTime}ms`);
    return stats;
}

// 0.04ms
async function benchViemKeccak256() {
    // Try the json joy encoding against this payload, in a browser tab
    const encoder = new MsgPackEncoder();
    const encoded = encoder.encode(payload);
    const stats: Stats = {
        size: encoded.length,
        encodeTime: 0,
        decodeTime: 0
    }
    
    for (let i = 0; i < runs; i++) {
        const start = performance.now();
        viemKeccak256(encoded);
        const end = performance.now();
        stats.encodeTime += end - start;
    }

    const avgEncodeTime = stats.encodeTime / runs;
    console.log("viem keccak256:")
    console.log(`Size: ${stats.size} bytes`);
    console.log(`Average encode time: ${avgEncodeTime}ms`);
    return stats;
}


// 0.02ms
async function benchJsKeccak256() {
    // Try the json joy encoding against this payload, in a browser tab
    const encoder = new MsgPackEncoder();
    const encoded = encoder.encode(payload);
    const stats: Stats = {
        size: encoded.length,
        encodeTime: 0,
        decodeTime: 0
    }
    
    for (let i = 0; i < runs; i++) {
        const start = performance.now();
        keccak256(encoded);
        const end = performance.now();
        stats.encodeTime += end - start;
    }

    const avgEncodeTime = stats.encodeTime / runs;
    console.log("js-sha3 keccak256:")
    console.log(`Size: ${stats.size} bytes`);
    console.log(`Average encode time: ${avgEncodeTime}ms`);
    return stats;
}


// 0.018ms
async function benchShake128() {
    // Try the json joy encoding against this payload, in a browser tab
    const encoder = new MsgPackEncoder();
    const encoded = encoder.encode(payload);
    const stats: Stats = {
        size: encoded.length,
        encodeTime: 0,
        decodeTime: 0
    }
    
    for (let i = 0; i < runs; i++) {
        const start = performance.now();
        shake128(encoded, 256);
        const end = performance.now();
        stats.encodeTime += end - start;
    }

    const avgEncodeTime = stats.encodeTime / runs;
    console.log("js-sha3 shake128:")
    console.log(`Size: ${stats.size} bytes`);
    console.log(`Average encode time: ${avgEncodeTime}ms`);
    return stats;
}

// Export the functions to make them available
export {
    benchJsonJoy,
    benchJson,
    benchMsgPackerFast,
    benchMsgPacker,
    benchJsSha256,
    benchViemSha256,
    benchNativeSha256,
    benchViemKeccak256,
    benchJsKeccak256,
    benchShake128
};

// benchMsgPackerFast();
// benchMsgPacker();
// benchJson();
// benchJsonJoy();