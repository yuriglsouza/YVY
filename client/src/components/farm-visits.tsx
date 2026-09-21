import { useId, useState } from 'react';
import { useInfiniteQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { visitInputSchema } from '@shared/farm-visit';
import { validateFarmImageMetadata } from '@shared/farm-image';
import type { FarmVisitView } from '@shared/schema';
import { Loader2, Plus, ClipboardList } from 'lucide-react';

type VisitPage = { visits: FarmVisitView[]; hasMore: boolean };
const displayDate = (value: string) => value.split('-').reverse().join('/');

async function sendPhoto(file: File, farmId: number) {
  const response = await apiRequest('POST', `/api/farms/${farmId}/visits/upload-url`, { contentType: file.type, size: file.size });
  const { path, signedUrl } = await response.json();
  const body = new FormData();
  body.append('cacheControl', '600');
  body.append('', file);
  const upload = await fetch(signedUrl, { method: 'PUT', headers: { 'x-upsert': 'false' }, body });
  if (!upload.ok) throw new Error('Falha ao enviar foto. Tente novamente.');
  return path as string;
}

export function FarmVisits({ farmId }: { farmId: number }) {
  const id = useId();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [observedOn, setObservedOn] = useState(new Date().toISOString().slice(0, 10));
  const [stage, setStage] = useState('');
  const [observations, setObservations] = useState('');
  const [management, setManagement] = useState('');
  const [photos, setPhotos] = useState<Array<{ file: File; path?: string }>>([]);
  const [fileKey, setFileKey] = useState(0);
  const queryKey = ['farm-visits', farmId];
  const visits = useInfiniteQuery({
    queryKey, initialPageParam: 0,
    queryFn: async ({ pageParam }) => (await apiRequest('GET', `/api/farms/${farmId}/visits?offset=${pageParam}`)).json() as Promise<VisitPage>,
    getNextPageParam: (last, pages) => last.hasMore ? pages.length * 20 : undefined,
    staleTime: 0, refetchInterval: 5 * 60 * 1000,
  });
  const save = useMutation({
    mutationFn: async () => {
      const values = visitInputSchema.parse({ observedOn, stage, observations, management });
      const photoPaths: string[] = [];
      for (let i = 0; i < photos.length; i++) {
        const photo = photos[i];
        const path = photo.path ?? await sendPhoto(photo.file, farmId);
        photoPaths.push(path);
        setPhotos(previous => previous.map((p, index) => index === i ? { ...p, path } : p));
      }
      return apiRequest('POST', `/api/farms/${farmId}/visits`, { ...values, photoPaths });
    },
    onSuccess: async () => {
      setStage(''); setObservations(''); setManagement(''); setPhotos([]); setFileKey(key => key + 1); setOpen(false);
      await queryClient.invalidateQueries({ queryKey });
      toast({ title: 'Vistoria salva', description: 'Registro adicionado ao histórico desta fazenda.' });
    },
    onError: (error: Error) => toast({ title: 'Não foi possível salvar', description: error.message, variant: 'destructive' }),
  });
  const records = visits.data?.pages.flatMap(page => page.visits) ?? [];

  return <section className="space-y-6 min-w-0">
    <div className="flex flex-wrap justify-between items-start gap-3">
      <div><h2 className="text-xl font-semibold flex gap-2 items-center"><ClipboardList className="w-5 h-5" />Histórico de vistorias</h2>
        <p className="text-sm text-muted-foreground mt-1">Observações reais de campo, organizadas por data. Não substituem as leituras de satélite.</p></div>
      <Button onClick={() => setOpen(value => !value)} disabled={save.isPending}><Plus className="w-4 h-4 mr-2" />{open ? 'Fechar formulário' : 'Registrar vistoria'}</Button>
    </div>
    {open && <form className="rounded-xl border bg-card p-4 sm:p-6 space-y-4" onSubmit={event => { event.preventDefault(); save.mutate(); }}>
      <fieldset disabled={save.isPending} className="space-y-4">
        <legend className="font-semibold mb-3">Nova vistoria</legend>
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-2"><Label htmlFor={`${id}-date`}>Data da visita</Label><Input id={`${id}-date`} type="date" required max={new Date().toISOString().slice(0, 10)} value={observedOn} onChange={e => setObservedOn(e.target.value)} /></div>
          <div className="space-y-2"><Label htmlFor={`${id}-stage`}>Estágio observado (opcional)</Label><Input id={`${id}-stage`} maxLength={120} placeholder="Ex.: Rebrota, V4, florescimento" value={stage} onChange={e => setStage(e.target.value)} /></div>
        </div>
        <div className="space-y-2"><Label htmlFor={`${id}-observations`}>Observações e problemas encontrados</Label><Textarea id={`${id}-observations`} required maxLength={4000} value={observations} onChange={e => setObservations(e.target.value)} /></div>
        <div className="space-y-2"><Label htmlFor={`${id}-management`}>Manejo realizado (opcional)</Label><Textarea id={`${id}-management`} maxLength={4000} value={management} onChange={e => setManagement(e.target.value)} /></div>
        <div className="space-y-2"><Label htmlFor={`${id}-photos`}>Fotos da visita (opcional)</Label>
          <Input key={fileKey} id={`${id}-photos`} type="file" multiple accept="image/jpeg,image/png,image/webp" onChange={e => {
            const files = Array.from(e.target.files ?? []);
            const error = files.length > 4 ? 'Escolha até quatro fotos.' : files.map(file => validateFarmImageMetadata({ contentType: file.type, size: file.size })).find(Boolean);
            if (error) { e.target.value = ''; setPhotos([]); toast({ title: 'Verifique as fotos', description: error, variant: 'destructive' }); return; }
            setPhotos(files.map(file => ({ file })));
          }} />
          <p className="text-xs text-muted-foreground">Até 4 fotos JPG, PNG ou WebP, de até 6 MB cada. Acesso restrito à fazenda; links de visualização expiram em 10 minutos.</p>
          {photos.length > 0 && <p className="text-xs break-words">{photos.map(photo => photo.file.name).join(', ')}</p>}
        </div>
        <p className="text-xs text-muted-foreground">Revise antes de salvar: o registro será acrescentado ao histórico, sem alterar vistorias anteriores ou o estágio do cadastro.</p>
        <Button type="submit" disabled={save.isPending}>{save.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}{save.isPending ? 'Salvando vistoria…' : 'Salvar vistoria'}</Button>
      </fieldset>
    </form>}
    {visits.isPending && <p role="status">Carregando vistorias…</p>}
    {visits.isError && <div role="alert">Não foi possível carregar o histórico. <Button variant="outline" onClick={() => visits.refetch()}>Tentar novamente</Button></div>}
    {!visits.isPending && !visits.isError && records.length === 0 && <p className="border rounded-xl p-8 text-muted-foreground text-center">Nenhuma vistoria registrada. Comece pela próxima visita de campo.</p>}
    {records.map(visit => <article key={visit.id} className="border rounded-xl bg-card p-4 sm:p-6 space-y-3 min-w-0">
      <div className="flex flex-wrap gap-3 justify-between"><h3 className="font-semibold">Visita de {displayDate(visit.observedOn)}</h3><span className="text-xs text-muted-foreground">Registro #{visit.id}</span></div>
      {visit.stage && <p className="break-words"><span className="text-muted-foreground">Estágio observado: </span>{visit.stage}</p>}
      <div><h4 className="text-sm text-muted-foreground">Observações</h4><p className="whitespace-pre-wrap break-words">{visit.observations}</p></div>
      {visit.management && <div><h4 className="text-sm text-muted-foreground">Manejo realizado</h4><p className="whitespace-pre-wrap break-words">{visit.management}</p></div>}
      {visit.photoUrls.length > 0 && <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">{visit.photoUrls.map((url, index) => <a key={index} href={url} target="_blank" rel="noreferrer"><img className="w-full h-36 rounded-lg object-cover" src={url} alt={`Foto ${index + 1} da vistoria de ${displayDate(visit.observedOn)}`} loading="lazy" /></a>)}</div>}
      {visit.photoPaths.length > visit.photoUrls.length && <p className="text-sm text-amber-600">Algumas fotos estão indisponíveis. O registro da vistoria está preservado.</p>}
    </article>)}
    {visits.hasNextPage && <Button variant="outline" disabled={visits.isFetchingNextPage} onClick={() => visits.fetchNextPage()}>Carregar visitas anteriores</Button>}
    <p className="text-xs text-muted-foreground">As cinco vistorias mais recentes entram como contexto textual nos próximos relatórios de IA. As fotos ficam disponíveis para consulta, sem análise automática.</p>
  </section>;
}
