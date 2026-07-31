# Fridge Controller Backend

Node.js + Express backend that:
- Subscribes to the device's MQTT status topic and logs it to SQLite
- Detects ON/OFF transitions and outages, turning them into history events
- Exposes the endpoints the app needs: `/status/latest`, `/history`, `/readings`, `/schedule`, `/command`
- Runs a scheduler that turns the fridge ON/OFF at the times set in `/schedule`, checked every 15s, independent of whether the app is open

## Setup

```
cp .env.example .env
# edit .env with your MQTT broker details
npm install
npm start
```

Uses `better-sqlite3` — a single `fridge.db` file, no separate database
server to run. Fine for one device; if you scale to many fridges later,
swap it for Postgres without changing the route logic much.

## MQTT broker

You need an actual MQTT broker running somewhere reachable by both:
- The ESP32 (over WiFi or GPRS, plain `mqtt://` on port 1883 is fine)
- This backend (same `mqtt://` connection)
- The app (needs a **WebSocket** listener on the broker, e.g. port 8884/9001,
  since browsers/RN can't open raw TCP sockets)

Easiest options:
- Self-host Mosquitto (add a `listener 8884` + `protocol websockets` block
  for the app's connection, alongside the default 1883 listener)
- Use a hosted broker like HiveMQ Cloud or EMQX Cloud — both give you TCP
  and WSS endpoints out of the box, free tier is enough for one device

## Deploying

Any Node host works (Railway, Render, a small VPS, etc.) — just make sure
outbound MQTT (1883) isn't blocked, and that `fridge.db` is on persistent
storage so history isn't lost on redeploy.
