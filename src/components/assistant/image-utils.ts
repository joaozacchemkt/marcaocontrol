/**
 * Prepara imagem pro assistente: reduz pro tamanho que a IA lê melhor
 * (lado maior até 1568px — acima disso a API reduz de qualquer jeito e só
 * custa mais) e comprime em JPEG. Print de celular de 3–5 MB vira ~300 KB.
 */
const MAX_SIDE = 1568;

export interface PreparedImage {
  blob: Blob;
  mediaType: "image/jpeg";
  previewUrl: string;
}

export async function prepareImage(file: File): Promise<PreparedImage> {
  if (!file.type.startsWith("image/")) throw new Error("Só dá pra enviar imagem.");
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Não consegui processar a imagem.");
  ctx.fillStyle = "#fff"; // PNG transparente não vira fundo preto no JPEG
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Falha ao comprimir a imagem."))), "image/jpeg", 0.88),
  );
  return { blob, mediaType: "image/jpeg", previewUrl: URL.createObjectURL(blob) };
}
