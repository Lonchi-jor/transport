# CCMM Flotte

Live vehicle map for **CCMM** — Construction Carrosserie Menuiserie Métallique.

The desk creates each chauffeur (indicatif + PIN). The phone only logs in with those credentials. GPS, courses, BN and the delivery-note photo then run on the handset.

The interface uses the CCMM mark and the logo blues: navy `#2B308F` and cyan `#00A4E8`.

## Tableau de bord dispatch (ordinateur)

Ouvrez [http://localhost:43147/admin](http://localhost:43147/admin) sur un PC. Le bloc **Tableau de bord dispatch** (à côté du logo, avec le sous-titre *Courses, carte et attribution*) est un bouton : il ramène toujours au dispatch.

- **Tableau de bord** : carte, nouvelle course, uniquement les courses actuellement en exécution.
- **Courses** : [http://localhost:43147/admin/courses](http://localhost:43147/admin/courses) — toutes les courses de tous les chauffeurs, avec filtres (chauffeur, sans chauffeur, statut, période du–au, type de véhicule, recherche).
- **Chauffeurs** : [http://localhost:43147/admin/chauffeurs](http://localhost:43147/admin/chauffeurs) — fiches, téléphone, véhicules, PIN, **statut de connexion** (vert / jaune / rouge) et historique. Sur la fiche, les compteurs **Courses / En cours / Terminées** sont des boutons : ils filtrent la liste de ce chauffeur.

1. **Enregistrez le chauffeur** dans **Chauffeurs** : indicatif (`ME-01`), nom, **téléphone**, **immatriculation du tracteur**, **remorque(s)** (une ou plusieurs plaques), **type**, et un code PIN.
2. Donnez l’indicatif et le PIN au chauffeur. Vous pouvez **modifier** la fiche à tout moment.
3. Sur le **tableau de bord**, le bouton **Nouvelle course** ouvre la **carte en plein écran**. Placez le **départ** : la carte s’y rend et pose un pin **Départ** ; glissez-le si besoin. Passez au **tour de ville** : posez la destination (pin **Destination**). Le **+** ajoute d’autres arrêts (jusqu’à 8) ; dès qu’il y en a plusieurs, ils sont numérotés **1, 2…**. L’itinéraire relie le départ à toutes les destinations. **Recherchez le chauffeur** (indicatif ou nom) : ceux **sans course en cours** sont listés en premier. Son véhicule se remplit tout seul. **Un chauffeur peut avoir jusqu’à deux courses** (attribuées ou en cours) : la seconde apparaît sur le téléphone, mais il doit **terminer la première** avant de la démarrer. Une troisième attribution est refusée. Le pin du chauffeur **ne se déplace pas à la main** : seule la géolocalisation du téléphone le fait bouger. La **note au chauffeur** s’affiche en grand sur le portable ; il doit la lire avant de démarrer. Une **cloche** sur le téléphone lui signale la nouvelle course : un clic, ou le démarrage de la course, fait disparaître l’alerte.
4. Ouvrez **Courses** pour l’historique complet. Dans la colonne **Action**, **Modifier** (sous **Ouvrir**) ouvre l’éditeur : même après le départ, le bureau peut **ajouter ou retirer une destination**, **changer ou ajouter une note**, et réattribuer le chauffeur. Le chauffeur reçoit une alerte. **Annuler** n’est possible que **avant le départ** (BN) : une confirmation demande *Voulez-vous réellement annuler cette course ?*. Une course **en route** ne s’annule plus. Le bureau ne voit pas le texte de la note dans le tableau : une pastille **Note envoyée** le signale, et le texte apparaît au survol (sans cliquer).
5. Quand le chauffeur **termine** (photo du BL, enregistrée en PDF couleur), la **cloche du dispatch** sonne sur **tous** les postes du bureau. Un clic sur l’alerte, ou l’ouverture de cette course, la fait disparaître.

Cliquez la **carte** (ou le bouton Carte) pour l’ouvrir en **plein écran**. Un clic sur un chauffeur ouvre sa fiche : **Attribuer une course** envoie vers la création, **chauffeur et véhicule déjà remplis** — il reste le départ et les destinations. S’il a déjà deux courses, le bouton est désactivé. Un chauffeur qui a **démarré** (BN validé) voit aussi l’itinéraire de **sa position actuelle** jusqu’aux destinations du tour.

## Téléphone chauffeur

Ouvrez [http://localhost:43147/](http://localhost:43147/) (ou le lien HTTPS `npm run phone`). Entrez **uniquement** l’indicatif et le PIN créés au bureau. Pas d’inscription sur le portable. Après la première connexion, **ce téléphone les mémorise** et se reconnecte tout seul à l’ouverture.

Le chauffeur appuie sur **Commencer**, saisit le **numéro du BN**, puis la course passe **en route**. Avant le départ, sa carte montre **uniquement sa position**. Dès qu’il a démarré, l’itinéraire part de **sa position actuelle** jusqu’aux destinations du tour — jamais les autres véhicules. Le bouton **Courses** n’affiche que **ses** courses **attribuées maintenant** ; l’**historique** s’ouvre à part. La barre du bas (chauffeur + course) se **baisse** et se **remonte** avec la flèche. Pour **terminer**, il **prend une photo** du **bon de livraison** et l’envoie : le bureau reçoit un **PDF couleur**. Le bureau **télécharge** le BL depuis `/admin`.

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
- Desk map keeps **the last GPS of every chauffeur**, even after disconnect. Pins are **green** (en ligne), **yellow** (vu il y a moins de 30 min) or **red** (déconnecté depuis plus de 30 min). Hover a pin to see the last-seen timestamp.
- The phone map shows **only this chauffeur** and the driving tour through every destination
- Installable phone app (home screen / PWA)
- **Google Maps** when you add an API key
- OpenStreetMap fallback so the app still runs without a key
- Real GPS by default
- Address suggestions on départ / tour destinations (Google Places if keyed, Photon otherwise)
- Driving itinerary on the phone **only after the job is started**, from the current GPS through the tour
- Photo of the delivery note to mark a job done; stored as a color PDF that dispatch can download

Chauffeur accounts persist in `.data/drivers.json`. Courses (and the vehicle used on each trip) persist in `.data/courses.json`. Last GPS and last-seen time persist in `.data/presence.json`, so the desk still sees a chauffeur after the phone goes offline.

## Google Maps

1. Create a key in Google Cloud with the **Maps JavaScript API** enabled.
2. Copy `.env.example` to `.env.local`.
3. Set `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`.
4. Restart the dev server.

Restrict the key to your domain before you ship.

## Stack

Next.js, TypeScript, Tailwind, shadcn/ui, Google Maps (`@vis.gl/react-google-maps`), Leaflet fallback.
