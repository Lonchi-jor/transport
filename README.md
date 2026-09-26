# CCMM Flotte

Live vehicle map for **CCMM** — Construction Carrosserie Menuiserie Métallique.

The desk creates each chauffeur (indicatif + PIN). The phone only logs in with those credentials. GPS, courses, BN and BL scan then run on the handset.

The interface uses the CCMM mark and the logo blues: navy `#2B308F` and cyan `#00A4E8`.

## Tableau de bord dispatch (ordinateur)

Ouvrez [http://localhost:43147/admin](http://localhost:43147/admin) sur un PC.

Le bouton **Chauffeurs** (en haut, ou la carte bleue à gauche) ouvre [http://localhost:43147/admin/chauffeurs](http://localhost:43147/admin/chauffeurs) : fiches, véhicules, PIN et historique de chaque chauffeur.

1. **Enregistrez le chauffeur** dans **Chauffeurs** : indicatif (`ME-01`), nom, **véhicule** (type + immatriculation), et un code PIN.
2. Donnez l’indicatif et le PIN au chauffeur. Vous pouvez **modifier** la fiche à tout moment.
3. Sur **Courses**, créez une course et **choisissez le chauffeur** : son véhicule se remplit tout seul. Vous pouvez encore le changer pour cette course seulement.
4. Cliquez un chauffeur dans **Chauffeurs** pour voir **toutes ses courses**.

Cliquez la **carte** (ou le bouton Carte) pour l’ouvrir en **plein écran**. Un clic sur un chauffeur qui a **démarré** sa course (BN validé) trace l’itinéraire de **sa position actuelle** jusqu’à la destination.

## Téléphone chauffeur

Ouvrez [http://localhost:43147/](http://localhost:43147/) (ou le lien HTTPS `npm run phone`). Entrez **uniquement** l’indicatif et le PIN créés au bureau. Pas d’inscription sur le portable.

Le chauffeur appuie sur **Commencer**, saisit le **numéro du BN**, puis la course passe **en route** et **l’itinéraire** s’affiche. Pour **terminer**, il scanne le **bon de livraison** : la caméra **détecte le papier**, le recadre (perspective + couleur, type CamScanner) et le joint à la course. Le bureau **télécharge** le BL depuis `/admin`.

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

3. Open the printed `https://….trycloudflare.com` URL on your phone, or scan the QR on the login screen.
4. Enter the **indicatif** and **PIN** created in `/admin`, then allow location. Use **Add to Home Screen** (iPhone Share sheet) or **Install app** (Android) to run it like a native app.
5. Leave the two terminals running. Refresh the phone after you save code.

## What you get

- Dispatch creates chauffeurs; the phone logs in with indicatif + PIN only
- Live map of every connected CCMM vehicle
- Vehicle list with speed, status, and last radio ping
- Installable phone app (home screen / PWA)
- **Google Maps** when you add an API key
- OpenStreetMap fallback so the app still runs without a key
- Real GPS by default
- Address suggestions on pickup / dropoff (Google Places if keyed, Photon otherwise)
- Driving itinerary on the map after the driver enters the BN and starts the job
- Color CamScanner-style delivery-note scan before a job can be marked done; dispatch can download the JPEG

Chauffeur accounts persist in `.data/drivers.json`. Courses (and the vehicle used on each trip) persist in `.data/courses.json`. Live GPS positions stay in memory and drop about 20 seconds after a phone goes offline.

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
