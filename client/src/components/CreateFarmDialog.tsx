import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertFarmSchema, type InsertFarm } from "@shared/schema";
import { useCreateFarm } from "@/hooks/use-farms";
import { useClients } from "@/hooks/use-clients";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useState } from "react";
import { Loader2, Plus } from "lucide-react";

export function CreateFarmDialog() {
  const [open, setOpen] = useState(false);
  const createFarm = useCreateFarm();
  const { data: clients } = useClients();

  const form = useForm<InsertFarm>({
    resolver: zodResolver(insertFarmSchema),
    defaultValues: {
      name: "",
      cropType: "",
      sizeHa: 0,
      latitude: 0,
      longitude: 0,
      clientId: null // Default null
    },
  });

  const onSubmit = (data: InsertFarm) => {
    createFarm.mutate(data, {
      onSuccess: () => {
        setOpen(false);
        form.reset();
      },
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
                placeholder="ex: Milho"
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

          <div className="pt-4 flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} className="rounded-xl">Cancelar</Button>
            <Button type="submit" disabled={createFarm.isPending} className="rounded-xl bg-primary text-white">
              {createFarm.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Criar Fazenda
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
