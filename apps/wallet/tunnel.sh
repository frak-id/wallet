#!/bin/bash
# Cloudflare tunnel for mobile testing
# This creates a public HTTPS URL with valid certificate
cloudflared tunnel --url https://localhost:3000
