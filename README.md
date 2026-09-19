# TransitLive

A mobile-first fleet tracker for transportation desks. Every phone that joins the app becomes a live vehicle (or a dispatch console) on a shared map.

Drivers broadcast GPS. Dispatchers watch every connected bus, taxi, truck, van, and courier bike update in near real time.

## Test on your phone while you develop

Phones will not load `http://127.0.0.1`. iOS also blocks GPS on plain HTTP, so use the HTTPS tunnel.

1. Start the app:

```bash
npm install
npm run dev
```

2. In a second terminal, publish an HTTPS link:

```bash
npm run phone
```

3. Open the printed `https://….trycloudflare.com` URL on your phone, or scan the QR on the join screen.
4. Join as **Driver** and allow location. Use **Add to Home Screen** (iPhone Share sheet) or **Install app** (Android) to run it like a native app.
5. Leave the two terminals running. Refresh the phone after you save code.

The join screen and the **Phone** button on the map show a live QR for the tunnel. Open that same link on a second phone to see both vehicles.

Same Wi-Fi without a tunnel (Android only, GPS may be blocked):

```bash
npm run dev
```

Then open `http://YOUR_LAN_IP:43147` on the phone.

## What you get

- Join as a **driver** or **dispatch desk**
- Live map of every connected device
- Vehicle list with speed, status, and last radio ping
- Installable phone app (home screen / PWA)
- **Google Maps** when you add an API key
- OpenStreetMap fallback so the app still runs without a key
- Simulated GPS if the phone blocks location
- Optional demo vehicles on a city loop for training

Positions live in memory on the server. They disappear about 20 seconds after a device goes offline. There is no login and no database.

## Google Maps

1. Create a key in Google Cloud with the **Maps JavaScript API** enabled.
2. Copy `.env.example` to `.env.local`.
3. Set `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`.
4. Restart the dev server.

Restrict the key to your domain before you ship.

## Demo fleet

On the map, tap **Demo fleet** to place four training vehicles on a Nairobi loop. They are labeled as demo units and do not replace real phones.

## Stack

Next.js, TypeScript, Tailwind, shadcn/ui, Google Maps (`@vis.gl/react-google-maps`), Leaflet fallback.
