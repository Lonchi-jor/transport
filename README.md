# CCMM Flotte

Live vehicle map for **CCMM** — Construction Carrosserie Menuiserie Métallique.

Every works phone that joins becomes a live unit on the shared map. Drivers broadcast GPS. The desk watches every connected vehicle.

The interface uses the CCMM mark and the logo blues: navy `#2B308F` and cyan `#00A4E8`.

## Tableau de bord dispatch (ordinateur)

Ouvrez [http://localhost:43147/admin](http://localhost:43147/admin) sur un PC.

Le bureau crée une course et l’attribue à un chauffeur. Cliquez la **carte** (ou le bouton Carte) pour l’ouvrir en **plein écran** avec tous les chauffeurs. Un clic sur un chauffeur qui a **démarré** sa course (BN validé) trace l’itinéraire de **sa position actuelle** jusqu’à la destination.

Le téléphone du chauffeur affiche la course tout de suite. Le chauffeur appuie sur **Commencer**, saisit le **numéro du BN**, puis la course passe **en route** et **l’itinéraire** s’affiche sur la carte. Pour **terminer**, il scanne le **bon de livraison** (caméra ou import) : l’app recadre le document **en couleur** (type CamScanner) et le joint à la course. Le bureau peut **télécharger** le BL depuis `/admin`.

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

## What you get

- Join as a **driver** or **dispatch desk**
- Live map of every connected CCMM vehicle
- Vehicle list with speed, status, and last radio ping
- Installable phone app (home screen / PWA)
- **Google Maps** when you add an API key
- OpenStreetMap fallback so the app still runs without a key
- Real GPS by default; optional training route only if you ask for it
- Address suggestions on pickup / dropoff (Google Places if keyed, Photon otherwise)
- Driving itinerary on the map after the driver enters the BN and starts the job
- Color CamScanner-style delivery-note scan before a job can be marked done; dispatch can download the JPEG

Positions live in memory on the server. They disappear about 20 seconds after a device goes offline. There is no login and no database.

## Google Maps

1. Create a key in Google Cloud with the **Maps JavaScript API** enabled.
2. Copy `.env.example` to `.env.local`.
3. Set `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`.
4. Restart the dev server.

Restrict the key to your domain before you ship.

## Demo fleet

On the map, tap **Demo fleet** to place four training vehicles. They are labeled as training units and do not replace real phones.

## Stack

Next.js, TypeScript, Tailwind, shadcn/ui, Google Maps (`@vis.gl/react-google-maps`), Leaflet fallback.
