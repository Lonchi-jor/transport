import L from "leaflet";

export function numberedMapIcon(kind: "voyage" | "stop", index?: number, draggable = false) {
  const color = kind === "voyage" ? "#00a4e8" : "#2b308f";
  const text = kind === "voyage" ? "Départ" : String((index ?? 0) + 1);
  const width = kind === "voyage" ? 84 : 44;
  const html = `
    <div class="composer-pin-hit${draggable ? "" : " is-static"}" style="width:${width}px">
      <div class="composer-pin-label" style="background:${color}">${text}</div>
      <div class="composer-pin-pointer" style="border-top-color:${color}"></div>
    </div>`;
  return L.divIcon({
    className: "composer-pin",
    html,
    iconSize: [width, 48],
    iconAnchor: [width / 2, 48],
  });
}
