# TransitLive

A mobile-first fleet tracker for transportation desks. Every phone that joins the app becomes a live vehicle (or a dispatch console) on a shared map.

Drivers broadcast GPS. Dispatchers watch every connected bus, taxi, truck, van, and courier bike update in near real time.

## What you get

- Join as a **driver** or **dispatch desk**
- Live map of every connected device
- Vehicle list with speed, status, and last radio ping
- **Google Maps** when you add an API key
- OpenStreetMap fallback so the app still runs without a key
- Simulated GPS if the phone blocks location
- Optional demo vehicles on a city loop for training

Positions live in memory on the server. They disappear about 20 seconds after a device goes offline. There is no login and no database.

## Run locally

```bash
npm install
npm run dev -- --port 43147
```

Open [http://localhost:43147](http://localhost:43147) on a phone and a dispatch laptop. Use the same Wi-Fi or tunnel if you want real vehicles to see each other.

## Google Maps

1. Create a key in Google Cloud with the **Maps JavaScript API** enabled.
2. Copy `.env.example` to `.env.local`.
3. Set `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`.
4. Restart the dev server.

Restrict the key to your domain before you ship.

## Demo fleet

On the map, tap the route button to place four training vehicles on a Nairobi loop. They are labeled as demo units and do not replace real phones.

## Stack

Next.js, TypeScript, Tailwind, shadcn/ui, Google Maps (`@vis.gl/react-google-maps`), Leaflet fallback.
