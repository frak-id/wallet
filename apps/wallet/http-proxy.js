#!/usr/bin/env node

/**
 * Simple HTTP proxy for mobile testing
 * Proxies HTTP requests on port 3003 to HTTPS dev server on port 3000
 *
 * Usage: node http-proxy.js
 * Then access from mobile: http://192.168.x.x:3003
 */

import http from "node:http";
import https from "node:https";

const HTTP_PORT = 3003;
const HTTPS_TARGET = "https://localhost:3000";

const server = http.createServer((req, res) => {
    const targetUrl = `${HTTPS_TARGET}${req.url}`;

    const proxyReq = https.request(
        targetUrl,
        {
            method: req.method,
            headers: {
                ...req.headers,
                host: "localhost:3000",
            },
            rejectUnauthorized: false, // Accept self-signed certs
        },
        (proxyRes) => {
            res.writeHead(proxyRes.statusCode, proxyRes.headers);
            proxyRes.pipe(res);
        }
    );

    proxyReq.on("error", (err) => {
        console.error("Proxy error:", err);
        res.writeHead(502);
        res.end("Bad Gateway");
    });

    req.pipe(proxyReq);
});

server.listen(HTTP_PORT, "0.0.0.0", () => {
    console.log(`🔓 HTTP proxy server running on http://0.0.0.0:${HTTP_PORT}`);
    console.log(`📱 Access from mobile: http://192.168.x.x:${HTTP_PORT}`);
    console.log(`🔐 Proxying to: ${HTTPS_TARGET}`);
});
