# OpenWRT Monitor

A real-time, responsive, and widget-based monitoring dashboard for OpenWRT routers. Track CPU, memory, traffic, temperature, and connected devices — all from a beautiful, PWA-enabled interface.

## Features

- **Real-Time Metrics**: CPU, RAM, load averages, temperature, and network traffic polling.
- **Historical Data**: SQLite database automatically stores up to 30 days of snapshots.
- **Drag & Drop Dashboard**: Highly customizable grid of 10 built-in interactive widgets powered by Gridstack.
- **Chart Visualizations**: Interactive time-series charts powered by Chart.js.
- **PWA Ready**: Installable to your mobile or desktop home screen with fully offline-capable caching.
- **Dark & Light Themes**: Beautiful custom UI with automatic local storage persistence.
- **Secure Handling**: XSS mitigations and connection handling for routers enforcing self-signed certificates.

## Setup & Instructions

**For complete installation, router configuration, and deployment instructions, please open the included Setup Guide.**

1. Clone or download this repository.
2. Open the `walkthrough.html` file in your preferred web browser:
   - Double-click `walkthrough.html` in your file explorer.
   - *Or* run the application in dev mode and navigate to `/walkthrough.html`.

The **Setup Guide** contains:
- Step-by-step instructions to enable LuCI JSON-RPC on your OpenWRT router (`apk` or `opkg`).
- Environment variable configuration guidelines (`.env`).
- NPM run scripts for development and production modes.
- Extended troubleshooting for common network or parsing errors.

## Tech Stack

- **Backend**: Node.js, Express, `better-sqlite3`, `node-fetch`
- **Frontend**: HTML5, Vanilla JavaScript, CSS custom variables
- **Tooling**: Vite (Multi-Page App compilation)
- **Libraries**: Gridstack.js (drag-and-drop), Chart.js (graphs)

---
*Built to make monitoring OpenWRT routers visually stunning and effortless.*
