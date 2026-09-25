import type { Farm } from "@shared/schema";

export type FarmSort = "name" | "recent" | "oldest" | "area";
export const normalizeFarmText = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .trim();

export function syncTimestamp(
  value: Farm["lastSyncAt"] | string,
): number | null {
  if (!value) return null;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
}

export function filterAndSortFarms(
  farms: Farm[],
  query: string,
  client: string,
  crop: string,
  sort: FarmSort,
): Farm[] {
  const search = normalizeFarmText(query);
  return farms
    .filter(
      (farm) =>
        normalizeFarmText(farm.name).includes(search) &&
        (client === "all" ||
          (client === "none"
            ? !farm.clientId
            : farm.clientId === Number(client))) &&
        (crop === "all" ||
          (crop === "none"
            ? !farm.cropType?.trim()
            : farm.cropType?.trim() === crop)),
    )
    .sort((a, b) => {
      if (sort === "area")
        return b.sizeHa - a.sizeHa || a.name.localeCompare(b.name, "pt-BR");
      if (sort === "recent" || sort === "oldest") {
        const difference =
          (syncTimestamp(b.lastSyncAt) ?? -Infinity) -
          (syncTimestamp(a.lastSyncAt) ?? -Infinity);
        if (difference && !Number.isNaN(difference))
          return sort === "recent" ? difference : -difference;
      }
      return a.name.localeCompare(b.name, "pt-BR");
    });
}

export function syncLabel(
  value: Farm["lastSyncAt"] | string,
  now = Date.now(),
): string {
  const timestamp = syncTimestamp(value);
  if (timestamp === null) return "Sem sincronização registrada";
  const days = Math.floor((now - timestamp) / 86_400_000);
  if (days < 0) return "Sincronização registrada";
  if (days === 0) return "Sincronizado há menos de 24h";
  return `Sincronizado há ${days} ${days === 1 ? "dia" : "dias"}`;
}
