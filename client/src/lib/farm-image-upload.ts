import { validateFarmImageMetadata } from "@shared/farm-image";

interface SignedUploadResponse {
  path: string;
  signedUrl: string;
}

export async function uploadFarmImage(file: File): Promise<string> {
  const validationError = validateFarmImageMetadata({
    contentType: file.type,
    size: file.size,
  });

  if (validationError) throw new Error(validationError);

  const signedResponse = await fetch("/api/farm-images/upload-url", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fileName: file.name,
      contentType: file.type,
      size: file.size,
    }),
  });

  if (!signedResponse.ok) {
    const error = await signedResponse.json().catch(() => ({}));
    throw new Error(error.message || "Não foi possível preparar o envio da foto.");
  }

  const { path, signedUrl } = await signedResponse.json() as SignedUploadResponse;
  const uploadBody = new FormData();
  uploadBody.append("cacheControl", "3600");
  uploadBody.append("", file);

  const uploadResponse = await fetch(signedUrl, {
    method: "PUT",
    headers: { "x-upsert": "false" },
    body: uploadBody,
  });

  if (!uploadResponse.ok) {
    throw new Error("O armazenamento recusou o envio da foto. Tente novamente.");
  }

  const confirmResponse = await fetch("/api/farm-images/confirm", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path }),
  });

  if (!confirmResponse.ok) {
    const error = await confirmResponse.json().catch(() => ({}));
    throw new Error(error.message || "Não foi possível validar a foto enviada.");
  }

  const result = await confirmResponse.json() as { publicUrl: string };
  return result.publicUrl;
}
