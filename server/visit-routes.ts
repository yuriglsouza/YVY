import type { Express, RequestHandler } from 'express';
import type { SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { IStorage } from './storage.js';
import { ownsVisitPhoto, visitInputSchema } from '../shared/farm-visit.js';
import { detectFarmImageContentType, FARM_IMAGE_EXTENSIONS, MAX_FARM_IMAGE_BYTES, validateFarmImageMetadata } from '../shared/farm-image.js';

const bucketName = 'farm-visit-photos';
const uploadSchema = z.object({ contentType: z.string(), size: z.number() }).strict();

export function registerVisitRoutes(app: Express, storage: IStorage, supabase: SupabaseClient | null,
  authenticated: RequestHandler, farmAccess: RequestHandler) {
  // Private bucket, provisioned through the Storage API (never SQL metadata writes).
  let ready: Promise<void> | undefined;
  const ensureBucket = () => {
    if (!supabase) throw new Error('O armazenamento de fotos não está disponível.');
    return ready ??= (async () => {
      const { data, error } = await supabase.storage.getBucket(bucketName);
      if (data) {
        if (data.public) throw new Error('O armazenamento de vistorias deve ser privado.');
        return;
      }
      if (error && !/not found|does not exist/i.test(error.message)) throw error;
      const result = await supabase.storage.createBucket(bucketName, {
        public: false, fileSizeLimit: MAX_FARM_IMAGE_BYTES,
        allowedMimeTypes: Object.keys(FARM_IMAGE_EXTENSIONS),
      });
      if (result.error) {
        // Another server instance may have provisioned the same bucket.
        const check = await supabase.storage.getBucket(bucketName);
        if (!check.data || check.data.public) throw result.error;
      }
    })().catch(error => { ready = undefined; throw error; });
  };

  app.get('/api/farms/:id/visits', authenticated, farmAccess, async (req, res) => {
    const offset = Number(req.query.offset ?? 0);
    if (!Number.isSafeInteger(offset) || offset < 0) return res.status(400).json({ message: 'Página inválida.' });
    const records = await storage.getVisits(Number(req.params.id), 21, offset);
    const visits = await Promise.all(records.slice(0, 20).map(async visit => {
      const photoUrls: string[] = [];
      if (supabase && visit.photoPaths.length) {
        const { data, error } = await supabase.storage.from(bucketName).createSignedUrls(visit.photoPaths, 600);
        if (!error && data) for (const photo of data) if (photo.signedUrl) photoUrls.push(photo.signedUrl);
      }
      return { ...visit, photoUrls };
    }));
    res.setHeader('Cache-Control', 'private, no-store');
    res.json({ visits, hasMore: records.length > 20 });
  });

  app.post('/api/farms/:id/visits/upload-url', authenticated, farmAccess, async (req, res) => {
    const parsed = uploadSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: 'Dados da imagem inválidos.' });
    const message = validateFarmImageMetadata(parsed.data);
    if (message) return res.status(400).json({ message });
    if (!supabase) return res.status(503).json({ message: 'Armazenamento de fotos indisponível.' });
    try {
      await ensureBucket();
      const path = `${Number(req.params.id)}/${(req.user as any).id}/${randomUUID()}.${FARM_IMAGE_EXTENSIONS[parsed.data.contentType]}`;
      const { data, error } = await supabase.storage.from(bucketName).createSignedUploadUrl(path);
      if (error || !data) throw error;
      res.json({ path: data.path, signedUrl: data.signedUrl });
    } catch (error) {
      console.error('[VISIT_UPLOAD_ERROR]', error);
      res.status(502).json({ message: 'Não foi possível preparar o envio da foto.' });
    }
  });

  app.post('/api/farms/:id/visits', authenticated, farmAccess, async (req, res) => {
    const parsed = visitInputSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.errors[0].message });
    const farmId = Number(req.params.id);
    const authorId = (req.user as any).id as number;
    if (parsed.data.photoPaths.some(path => !ownsVisitPhoto(path, farmId, authorId))) {
      return res.status(403).json({ message: 'Foto não pertence a este envio e fazenda.' });
    }
    if (new Set(parsed.data.photoPaths).size !== parsed.data.photoPaths.length) {
      return res.status(400).json({ message: 'Não repita a mesma foto.' });
    }
    if (parsed.data.photoPaths.length && !supabase) return res.status(503).json({ message: 'Armazenamento de fotos indisponível.' });
    try {
      for (const path of parsed.data.photoPaths) {
        await ensureBucket();
        const { data, error } = await supabase!.storage.from(bucketName).download(path);
        if (error || !data) return res.status(400).json({ message: 'Foto não encontrada. Envie novamente.' });
        const bytes = new Uint8Array(await data.arrayBuffer());
        const type = detectFarmImageContentType(bytes);
        if (validateFarmImageMetadata({ size: bytes.length, contentType: type ?? '' }) || !path.endsWith(`.${FARM_IMAGE_EXTENSIONS[type!]}`)) {
          return res.status(400).json({ message: 'Conteúdo da foto inválido. Use JPG, PNG ou WebP de até 6 MB.' });
        }
      }
      const visit = await storage.createVisit({ ...parsed.data, farmId, authorId });
      res.status(201).json(visit);
    } catch (error) {
      console.error('[VISIT_CREATE_ERROR]', error);
      res.status(500).json({ message: 'Não foi possível salvar a vistoria. Seus dados permanecem no formulário.' });
    }
  });
}
