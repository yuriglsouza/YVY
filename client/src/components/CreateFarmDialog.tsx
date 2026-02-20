import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertFarmSchema, type InsertFarm, type Farm } from "@shared/schema";
import { useCreateFarm, useUpdateFarm } from "@/hooks/use-farms";
import { useClients } from "@/hooks/use-clients";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useState } from "react";
import { Loader2, Plus, Pencil } from "lucide-react";

import { useToast } from "@/hooks/use-toast";

function FarmForm({ onSubmit, defaultValues, isPending, submitLabel }: { onSubmit: (data: InsertFarm) => void, defaultValues?: Partial<InsertFarm>, isPending: boolean, submitLabel: string }) {
  const { data: clients } = useClients();

  const form = useForm<InsertFarm>({
    resolver: zodResolver(insertFarmSchema),
    defaultValues: {
      name: "",
      cropType: "",
      sizeHa: 0,
      latitude: 0,
      longitude: 0,
      clientId: null,
      imageUrl: "",
      ...defaultValues
    },
  });

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
      <div className="grid gap-2">
        <Label htmlFor="name">Nome da Fazenda</Label>
        <Input
          id="name"
          {...form.register("name")}
          className="rounded-lg"
          placeholder="ex: Gleba A Vale do Sol"
        />
        {form.formState.errors.name && (
          <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
        )}
      </div>

      <div className="grid gap-2">
        <Label>Cliente (Opcional)</Label>
        <Select
          onValueChange={(value) => form.setValue("clientId", Number(value))}
          defaultValue={form.getValues("clientId") ? String(form.getValues("clientId")) : undefined}
          // Handle initial value for Select if defaultValues are provided
          value={form.watch("clientId") ? String(form.watch("clientId")) : undefined}
        >
          <SelectTrigger className="rounded-lg">
            <SelectValue placeholder="Selecione um cliente..." />
          </SelectTrigger>
          <SelectContent>
            {clients?.map(client => (
              <SelectItem key={client.id} value={String(client.id)}>
                {client.name} {client.company ? `(${client.company})` : ''}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-2">
          <Label htmlFor="cropType">Tipo de Cultura</Label>
          <Input
            id="cropType"
            {...form.register("cropType")}
            className="rounded-lg"
            placeholder="ex: Soja, Pastagem"
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="sizeHa">Tamanho (Ha)</Label>
          <Input
            id="sizeHa"
            type="number"
            step="0.1"
            {...form.register("sizeHa", { valueAsNumber: true })}
            className="rounded-lg"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-2">
          <Label htmlFor="latitude">Latitude</Label>
          <Input
            id="latitude"
            type="number"
            step="0.000001"
            {...form.register("latitude", { valueAsNumber: true })}
            className="rounded-lg"
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="longitude">Longitude</Label>
          <Input
            id="longitude"
            type="number"
            step="0.000001"
            {...form.register("longitude", { valueAsNumber: true })}
            className="rounded-lg"
          />
        </div>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="imageUrl">URL da Imagem (Opcional)</Label>
        <Input
          id="imageUrl"
          {...form.register("imageUrl")}
          className="rounded-lg"
          placeholder="https://exemplo.com/foto-fazenda.jpg"
        />
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

export function CreateFarmDialog() {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const createFarm = useCreateFarm();

  const onSubmit = (data: InsertFarm) => {
    createFarm.mutate(data, {
      onSuccess: () => {
        setOpen(false);
        toast({
          title: "Fazenda criada com sucesso!",
          description: `${data.name} foi adicionada.`,
        });
      },
      onError: () => {
        toast({
          variant: "destructive",
          title: "Erro ao criar fazenda",
          description: "Verifique os dados e tente novamente."
        });
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/20 rounded-xl">
          <Plus className="w-4 h-4 mr-2" />
          Adicionar Nova Fazenda
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px] bg-card rounded-2xl border-border shadow-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-display">Registrar Nova Fazenda</DialogTitle>
        </DialogHeader>
        <FarmForm onSubmit={onSubmit} isPending={createFarm.isPending} submitLabel="Criar Fazenda" />
      </DialogContent>
    </Dialog>
  );
}

export function EditFarmDialog({ farm, trigger }: { farm: Farm, trigger?: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const updateFarm = useUpdateFarm();

  const onSubmit = (data: InsertFarm) => {
    updateFarm.mutate({ id: farm.id, data }, {
      onSuccess: () => {
        setOpen(false);
        toast({
          title: "Fazenda atualizada",
          description: "As alterações foram salvas com sucesso.",
        });
      },
      onError: (error) => {
        toast({
          variant: "destructive",
          title: "Erro ao atualizar",
          description: error.message || "Ocorreu um erro ao tentar salvar."
        });
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="ghost" size="icon">
            <Pencil className="w-4 h-4" />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px] bg-card rounded-2xl border-border shadow-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-display">Editar Fazenda</DialogTitle>
        </DialogHeader>
        <FarmForm
          onSubmit={onSubmit}
          isPending={updateFarm.isPending}
          submitLabel="Salvar Alterações"
          defaultValues={{
            name: farm.name,
            cropType: farm.cropType,
            sizeHa: farm.sizeHa,
            latitude: farm.latitude,
            longitude: farm.longitude,
            clientId: farm.clientId,
            imageUrl: farm.imageUrl
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
