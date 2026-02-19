import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import { farms, type InsertFarm } from "@shared/schema";
import { z } from "zod";

export function useFarms() {
  return useQuery({
    queryKey: [api.farms.list.path],
    queryFn: async () => {
      const res = await fetch(api.farms.list.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch farms");
      return api.farms.list.responses[200].parse(await res.json());
    },
  });
}

export function useFarm(id: number) {
  return useQuery({
    queryKey: [api.farms.get.path, id],
    queryFn: async () => {
      const url = buildUrl(api.farms.get.path, { id });
      const res = await fetch(url, { credentials: "include" });
      if (res.status === 404) return null;
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(`Error ${res.status}: ${errorData.message || "Failed to fetch farm"}`);
      }
      return api.farms.get.responses[200].parse(await res.json());
    },
    enabled: !isNaN(id),
  });
}

export function useCreateFarm() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: InsertFarm) => {
      const validated = api.farms.create.input.parse(data);
      const res = await fetch(api.farms.create.path, {
        method: api.farms.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validated),
        credentials: "include",
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to create farm");
      }
      return api.farms.create.responses[201].parse(await res.json());
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [api.farms.list.path] }),
  });
}

export function useUpdateFarm() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: number, data: Partial<InsertFarm> }) => {
      const url = buildUrl(api.farms.update.path, { id });
      const res = await fetch(url, {
        method: api.farms.update.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to update farm");
      }
      return api.farms.update.responses[200].parse(await res.json());
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [api.farms.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.farms.get.path, data.id] });
    },
  });
}

export function useRefreshReadings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const url = buildUrl(api.farms.refreshReadings.path, { id });
      const res = await fetch(url, {
        method: api.farms.refreshReadings.method,
        credentials: "include"
      });
      if (!res.ok) throw new Error("Failed to refresh readings");
      return res.json();
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: [api.readings.list.path, id] });
      queryClient.invalidateQueries({ queryKey: [api.readings.latest.path, id] });
      queryClient.invalidateQueries({ queryKey: [api.farms.list.path] });
      queryClient.invalidateQueries({ queryKey: ["alerts"] }); // Trigger notifications bell
    },
  });
}
