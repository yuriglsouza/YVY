export const MAX_FARM_IMAGE_BYTES = 6 * 1024 * 1024;

export const FARM_IMAGE_EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export interface FarmImageMetadata {
  contentType: string;
  size: number;
}

export function validateFarmImageMetadata(metadata: FarmImageMetadata): string | null {
  if (!FARM_IMAGE_EXTENSIONS[metadata.contentType]) {
    return "Use uma imagem JPG, PNG ou WebP.";
  }

  if (!Number.isFinite(metadata.size) || metadata.size <= 0) {
    return "O arquivo de imagem está vazio ou inválido.";
  }

  if (metadata.size > MAX_FARM_IMAGE_BYTES) {
    return "A imagem deve ter no máximo 6 MB.";
  }

  return null;
}

export function detectFarmImageContentType(bytes: Uint8Array): string | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }

  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return "image/png";
  }

  if (
    bytes.length >= 12 &&
    String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]) === "RIFF" &&
    String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11]) === "WEBP"
  ) {
    return "image/webp";
  }

  return null;
}
