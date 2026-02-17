import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useClients, useCreateClient, useUpdateClient, useDeleteClient } from "@/hooks/use-clients";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertClientSchema, type InsertClient, type Client } from "@shared/schema";
import { Loader2, Plus, Users, Search, Phone, Mail, Pencil, Trash2, MoreVertical } from "lucide-react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { Sidebar, MobileNav } from "@/components/Sidebar";

export default function ClientList() {
    const { data: clients, isLoading } = useClients();
    const [searchTerm, setSearchTerm] = useState("");
    const deleteClient = useDeleteClient();
    const { toast } = useToast();

    const filteredClients = clients?.filter(client =>
        client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        client.company?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleDelete = (id: number) => {
        deleteClient.mutate(id, {
            onSuccess: () => {
                toast({
                    title: "Cliente excluído",
                    description: "O cliente foi removido com sucesso.",
                });
            },
            onError: () => {
                toast({
                    variant: "destructive",
                    title: "Erro ao excluir",
                    description: "Não foi possível remover o cliente. Verifique se existem fazendas vinculadas.",
                });
            }
        });
    };

    return (
        <div className="flex min-h-screen">
            <Sidebar />
            <MobileNav />
            <main className="flex-1 ml-0 lg:ml-64 p-4 lg:p-8 pt-16 lg:pt-8 overflow-y-auto">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                    <div>
                        <h1 className="text-3xl font-display font-bold text-foreground mb-2">Gestão de Clientes</h1>
                        <p className="text-muted-foreground">Gerencie produtores e empresas parceiras.</p>
                    </div>
                    <CreateClientDialog />
                </div>

                <div className="relative mb-8">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Buscar clientes por nome ou empresa..."
                        className="pl-10 max-w-md bg-card rounded-xl border-border"
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
                            <Card key={client.id} className="rounded-2xl border-border shadow-sm hover:shadow-md transition-all duration-200 bg-card group relative">
                                <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" size="icon" className="h-8 w-8">
                                                <MoreVertical className="h-4 w-4" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            <EditClientDialog client={client} />
                                            <AlertDialog>
                                                <AlertDialogTrigger asChild>
                                                    <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive">
                                                        <Trash2 className="w-4 h-4 mr-2" />
                                                        Excluir
                                                    </DropdownMenuItem>
                                                </AlertDialogTrigger>
                                                <AlertDialogContent>
                                                    <AlertDialogHeader>
                                                        <AlertDialogTitle>Excluir Cliente?</AlertDialogTitle>
                                                        <AlertDialogDescription>
                                                            Isso removerá permanentemente o cliente <b>{client.name}</b>.
                                                            Fazendas vinculadas serão desvinculadas.
                                                        </AlertDialogDescription>
                                                    </AlertDialogHeader>
                                                    <AlertDialogFooter>
                                                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                                        <AlertDialogAction onClick={() => handleDelete(client.id)} className="bg-destructive hover:bg-destructive/90">
                                                            Excluir
                                                        </AlertDialogAction>
                                                    </AlertDialogFooter>
                                                </AlertDialogContent>
                                            </AlertDialog>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>
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
                                    <CardTitle className="text-lg font-bold text-foreground pr-8">{client.name}</CardTitle>
                                    <CardDescription className="line-clamp-1">{client.notes || "Sem observações"}</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                    <div className="flex items-center text-sm text-muted-foreground">
                                        <Mail className="w-4 h-4 mr-2 opacity-70" />
                                        {client.email || "—"}
                                    </div>
                                    <div className="flex items-center text-sm text-muted-foreground">
                                        <Phone className="w-4 h-4 mr-2 opacity-70" />
                                        {client.phone || "—"}
                                    </div>
                                </CardContent>
                            </Card>
                        ))}

                        {filteredClients?.length === 0 && (
                            <div className="col-span-full py-12 text-center text-muted-foreground bg-card rounded-2xl border border-dashed border-border">
                                <p>Nenhum cliente encontrado.</p>
                            </div>
                        )}
                    </div>
                )}
            </main>
        </div>
    );
}

function ClientForm({ onSubmit, defaultValues, isPending, submitLabel }: { onSubmit: (data: InsertClient) => void, defaultValues?: Partial<InsertClient>, isPending: boolean, submitLabel: string }) {
    const form = useForm<InsertClient>({
        resolver: zodResolver(insertClientSchema),
        defaultValues: {
            name: "",
            email: "",
            phone: "",
            company: "",
            notes: "",
            ...defaultValues
        }
    });

    return (
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
                <Button type="submit" disabled={isPending} className="rounded-xl bg-primary text-white w-full">
                    {isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                    {submitLabel}
                </Button>
            </div>
        </form>
    );
}

function CreateClientDialog() {
    const [open, setOpen] = useState(false);
    const { toast } = useToast();
    const createClient = useCreateClient();

    const onSubmit = (data: InsertClient) => {
        createClient.mutate(data, {
            onSuccess: () => {
                setOpen(false);
                toast({
                    title: "Cliente criado com sucesso!",
                    description: `${data.name} foi adicionado à sua lista.`,
                });
            },
            onError: (error) => {
                toast({
                    variant: "destructive",
                    title: "Erro ao criar cliente",
                    description: error.message || "Ocorreu um erro ao tentar salvar.",
                });
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
                <ClientForm onSubmit={onSubmit} isPending={createClient.isPending} submitLabel="Salvar Cliente" />
            </DialogContent>
        </Dialog>
    );
}

function EditClientDialog({ client }: { client: Client }) {
    const [open, setOpen] = useState(false);
    const { toast } = useToast();
    const updateClient = useUpdateClient();

    const onSubmit = (data: InsertClient) => {
        updateClient.mutate({ id: client.id, data }, {
            onSuccess: () => {
                setOpen(false);
                toast({
                    title: "Cliente atualizado",
                    description: "As alterações foram salvas com sucesso.",
                });
            },
            onError: (error) => {
                toast({
                    variant: "destructive",
                    title: "Erro ao atualizar",
                    description: error.message || "Ocorreu um erro ao tentar salvar.",
                });
            }
        });
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                    <Pencil className="w-4 h-4 mr-2" />
                    Editar
                </DropdownMenuItem>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px] bg-card rounded-2xl border-border shadow-2xl">
                <DialogHeader>
                    <DialogTitle className="text-xl font-display">Editar Cliente</DialogTitle>
                </DialogHeader>
                <ClientForm
                    onSubmit={onSubmit}
                    isPending={updateClient.isPending}
                    submitLabel="Salvar Alterações"
                    defaultValues={{
                        name: client.name,
                        email: client.email || "",
                        phone: client.phone || "",
                        company: client.company || "",
                        notes: client.notes || ""
                    }}
                />
            </DialogContent>
        </Dialog>
    );
}
