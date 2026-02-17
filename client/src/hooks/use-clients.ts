import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@shared/routes";
import { type InsertClient } from "@shared/schema";

export function useClients() {
    return useQuery({
        queryKey: [api.clients.list.path],
        queryFn: async () => {
            const res = await fetch(api.clients.list.path, { credentials: "include" });
            if (!res.ok) throw new Error("Failed to fetch clients");
            return api.clients.list.responses[200].parse(await res.json());
        },
    });
}

export function useCreateClient() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (data: InsertClient) => {
            const validated = api.clients.create.input.parse(data);
            const res = await fetch(api.clients.create.path, {
                method: api.clients.create.method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(validated),
                credentials: "include",
            });
            if (!res.ok) throw new Error("Failed to create client");
            return api.clients.create.responses[201].parse(await res.json());
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: [api.clients.list.path] }),
    });
}
