import { useQuery } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";

export function useReadings(farmId: number) {
  return useQuery({
    queryKey: [api.readings.list.path, farmId],
    queryFn: async () => {
      const url = buildUrl(api.readings.list.path, { id: farmId });
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch readings");
      return api.readings.list.responses[200].parse(await res.json());
    },
    enabled: !isNaN(farmId),
  });
}

export function useLatestReading(farmId: number) {
  return useQuery({
    queryKey: [api.readings.latest.path, farmId],
    queryFn: async () => {
      const url = buildUrl(api.readings.latest.path, { id: farmId });
      const res = await fetch(url, { credentials: "include" });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error("Failed to fetch latest reading");
      return api.readings.latest.responses[200].parse(await res.json());
    },
    enabled: !isNaN(farmId),
  });
}
