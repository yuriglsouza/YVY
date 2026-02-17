import { useState } from "react";
import { useClients, useCreateClient } from "@/hooks/use-clients";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertClientSchema, type InsertClient } from "@shared/schema";
import { Loader2, Plus, Users, Search, Phone, Mail, Building } from "lucide-react";

export default function ClientList() {
    const { data: clients, isLoading } = useClients();
    const [searchTerm, setSearchTerm] = useState("");

    const filteredClients = clients?.filter(client =>
        client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        client.company?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="min-h-screen bg-neutral-50 p-6 md:p-8 space-y-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-display text-neutral-900 mb-2">Gestão de Clientes</h1>
                    <p className="text-neutral-500">Gerencie produtores e empresas parceiras.</p>
                </div>
                <CreateClientDialog />
            </div>

            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                    placeholder="Buscar clientes por nome ou empresa..."
                    className="pl-10 max-w-md bg-white rounded-xl border-border/60"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>

            {isLoading ? (
                <div className="flex justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredClients?.map(client => (
                        <Card key={client.id} className="rounded-2xl border-border/60 shadow-sm hover:shadow-md transition-all duration-200">
                            <CardHeader className="pb-3">
                                <div className="flex items-start justify-between">
                                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-2">
                                        <Users className="w-5 h-5" />
                                    </div>
                                    {client.company && (
                                        <span className="text-xs font-medium px-2 py-1 rounded-full bg-secondary text-secondary-foreground">
                                            {client.company}
                                        </span>
                                    )}
                                </div>
                                <CardTitle className="text-lg font-bold text-foreground">{client.name}</CardTitle>
                                <CardDescription className="line-clamp-1">{client.notes || "Sem observações"}</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                <div className="flex items-center text-sm text-neutral-600">
                                    <Mail className="w-4 h-4 mr-2 text-neutral-400" />
                                    {client.email || "—"}
                                </div>
                                <div className="flex items-center text-sm text-neutral-600">
                                    <Phone className="w-4 h-4 mr-2 text-neutral-400" />
                                    {client.phone || "—"}
                                </div>
                            </CardContent>
                        </Card>
                    ))}

                    {filteredClients?.length === 0 && (
                        <div className="col-span-full py-12 text-center text-muted-foreground bg-white rounded-2xl border border-dashed border-border">
                            <p>Nenhum cliente encontrado.</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

function CreateClientDialog() {
    const [open, setOpen] = useState(false);
    const createClient = useCreateClient();

    const form = useForm<InsertClient>({
        resolver: zodResolver(insertClientSchema),
        defaultValues: {
            name: "",
            email: "",
            phone: "",
            company: "",
            notes: ""
        }
    });

    const onSubmit = (data: InsertClient) => {
        createClient.mutate(data, {
            onSuccess: () => {
                setOpen(false);
                form.reset();
            }
        });
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button className="bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/20 rounded-xl">
                    <Plus className="w-4 h-4 mr-2" />
                    Novo Cliente
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px] bg-card rounded-2xl border-border shadow-2xl">
                <DialogHeader>
                    <DialogTitle className="text-xl font-display">Cadastrar Cliente</DialogTitle>
                </DialogHeader>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
                    <div className="grid gap-2">
                        <Label htmlFor="name">Nome Completo</Label>
                        <Input id="name" {...form.register("name")} className="rounded-lg" placeholder="ex: João da Silva" />
                        {form.formState.errors.name && <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                            <Label htmlFor="email">Email</Label>
                            <Input id="email" {...form.register("email")} className="rounded-lg" placeholder="joao@email.com" />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="phone">Telefone</Label>
                            <Input id="phone" {...form.register("phone")} className="rounded-lg" placeholder="(00) 00000-0000" />
                        </div>
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="company">Empresa / Fazenda</Label>
                        <Input id="company" {...form.register("company")} className="rounded-lg" placeholder="ex: Agro Silva Ltda" />
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="notes">Observações</Label>
                        <Textarea id="notes" {...form.register("notes")} className="rounded-lg resize-none" rows={3} placeholder="Informações adicionais..." />
                    </div>

                    <div className="pt-4 flex justify-end gap-2">
                        <Button type="button" variant="outline" onClick={() => setOpen(false)} className="rounded-xl">Cancelar</Button>
                        <Button type="submit" disabled={createClient.isPending} className="rounded-xl bg-primary text-white">
                            {createClient.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                            Salvar Cliente
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
