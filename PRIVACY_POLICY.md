# Privacy Policy — ZenTerm

Last updated: 2026-03-21

## Overview

ZenTerm is a mobile terminal application that connects to your own server via the ZenTerm-gateway. This app is designed to work entirely within your private network.

## Data Collection

ZenTerm does **not** collect, store, or transmit any personal data to third parties.

- **No analytics or tracking** — The app does not include any analytics SDKs or tracking services.
- **No user accounts** — There is no sign-up, login, or cloud account system.
- **No data sharing** — No data is sent to the developer or any third party.

## Data Stored on Your Device

The following data is stored locally on your device only:

| Data | Purpose | Storage |
|------|---------|---------|
| Server URL | Connect to your gateway server | iOS Keychain (via expo-secure-store) |
| Authentication token | Authenticate with your gateway server | iOS Keychain (via expo-secure-store) |
| App preferences | Theme, font size settings | AsyncStorage (device-local) |

This data never leaves your device except when communicating directly with your own server.

## Network Communication

The app communicates **only** with the server(s) you explicitly configure:

- All connections are initiated by you.
- Communication is between your iPhone and your server over your own network (LAN or VPN).
- No data is sent to any other server, API, or cloud service.

## Camera Usage

The app requests camera access solely to scan QR codes displayed by the ZenTerm-gateway for quick server setup. No photos or videos are captured or stored.

## Photo Library Usage

The app may request photo library access to upload images to terminal sessions on your server. Images are sent only to your configured server.

## Children's Privacy

This app is not directed at children under 13 and does not knowingly collect data from children.

## Changes

We may update this policy from time to time. Changes will be posted in this repository.

## Contact

If you have questions about this privacy policy, please open an issue at:
https://github.com/phni3j9a/zenterm/issues
