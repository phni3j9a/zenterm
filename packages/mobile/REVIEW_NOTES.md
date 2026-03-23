# App Store Review Notes — ZenTerm

App Store Connect の「審査に関する情報」>「メモ」に以下を貼り付けてください。

---

## What is ZenTerm?

ZenTerm is a mobile terminal client that connects to the user's own server (e.g., Raspberry Pi, home lab, VPS) running the ZenTerm-gateway software. It provides SSH-like terminal access from an iPhone.

## Why NSAllowsArbitraryLoads is required

This app connects to user-configured servers on their local network (LAN) or private VPN (e.g., Tailscale). These servers use local IP addresses (e.g., 192.168.x.x, 10.x.x.x) or mDNS hostnames (e.g., raspi.local), which cannot obtain valid TLS/SSL certificates. HTTP and WebSocket (ws://) connections to these local addresses are essential for the app to function. No data is sent to any third-party server.

## Camera Usage

The camera is used solely to scan QR codes displayed by the ZenTerm-gateway during initial server setup. No photos or videos are captured or stored.

## Demo Instructions

To test the app without a server:
1. Launch the app — you will see the Sessions tab with a setup guide.
2. Navigate to the Settings tab to see app configuration.
3. Tap "Server Management" to see the server registration form with QR scan support.

To test with a live server (optional):
- Server URL: [YOUR_DEMO_SERVER_URL]
- Token: [YOUR_DEMO_TOKEN]
- Enter these in Settings > Server Management > add server manually.

## Privacy Policy

https://github.com/phni3j9a/zenterm/blob/main/PRIVACY_POLICY.md

## Notes

- This app does not include any analytics, tracking, or advertising.
- All data is stored locally on the device (iOS Keychain for credentials, AsyncStorage for preferences).
- The app requires the user's own server to be fully functional — similar to SSH client apps on the App Store.
