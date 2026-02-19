import { useQuery } from "@tanstack/react-query";

interface User {
    id: number;
    email: string;
    name: string;
    googleId: string;
    avatarUrl: string;
    role: "admin" | "user";
    subscriptionStatus: "active" | "trial" | "expired";
}

export function useUser() {
    return useQuery<User>({
        queryKey: ["/api/user"],
        retry: false,
        staleTime: 5 * 60 * 1000, // 5 minutes
    });
}
