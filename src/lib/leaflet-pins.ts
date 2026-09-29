import L from "leaflet";

export function numberedMapIcon(
  kind: "voyage" | "stop",
  index?: number,
  draggable = false,
  stopCount = 1,
) {
  const numberedStops = kind === "stop" && stopCount > 1;
  const color = kind === "voyage" ? "#00a4e8" : "#2b308f";
  const text = kind === "voyage" ? "Départ" : numberedStops ? String((index ?? 0) + 1) : "Destination";
  const width = kind === "voyage" ? 84 : numberedStops ? 44 : 118;
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
