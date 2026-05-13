import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";

export function useReports(farmId: number) {
  return useQuery({
    queryKey: [api.reports.list.path, farmId],
    queryFn: async () => {
      const url = buildUrl(api.reports.list.path, { id: farmId });
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch reports");
      return api.reports.list.responses[200].parse(await res.json());
    },
    enabled: !isNaN(farmId),
  });
}

export function useGenerateReport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ farmId, sourceReadingId }: { farmId: number, sourceReadingId?: number }) => {
      const url = buildUrl(api.reports.generate.path, { id: farmId });
      const res = await fetch(url, {
        method: api.reports.generate.method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceReadingId }),
        credentials: "include",
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to generate report");
      }
      return api.reports.generate.responses[201].parse(await res.json());
    },
    onSuccess: (_, { farmId }) => {
      queryClient.invalidateQueries({ queryKey: [api.reports.list.path, farmId] });
      queryClient.invalidateQueries({ queryKey: ["reports", farmId] });
    },
  });
}
