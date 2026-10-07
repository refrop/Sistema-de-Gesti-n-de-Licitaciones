import { z } from "zod";
import { db } from "../lib/db";
import { DomainError } from "../domain/errors";
import {
  createSignedUploadUrl,
  fileInfo,
  publicUrl,
  removeFile,
  uploadPdf,
} from "../lib/storage";

export const MAX_PROPOSAL_SIZE = 10 * 1024 * 1024;

export const uploadUrlSchema = z.object({
  fileName: z.string().min(1, "fileName obligatorio"),
  size: z.number().int().min(1, "size debe ser positivo").max(MAX_PROPOSAL_SIZE),
  contentType: z.string().min(1, "contentType obligatorio"),
});

export type UploadUrlInput = z.infer<typeof uploadUrlSchema>;

export const confirmSchema = z.object({
  path: z.string().min(1, "path obligatorio"),
});

const PDF_MAGIC = "%PDF-";

function looksLikePdf(body: Buffer): boolean {
  const head = body.subarray(0, 1024).toString("latin1");
  return head.includes(PDF_MAGIC);
}

function sanitizeFileName(raw: string): string {
  const base = raw.split(/[\\/]/).pop() ?? "propuesta.pdf";
  const withoutExt = base.replace(/\.pdf$/i, "");
  const ascii = withoutExt
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9._-]+/g, "_")
    .replace(/_{2,}/g, "_")
    .replace(/^[._-]+|[._-]+$/g, "")
    .slice(0, 60);
  return `${ascii || "propuesta"}.pdf`;
}

function displayName(path: string): string {
  const base = path.split("/").pop() ?? "propuesta.pdf";
  return base.replace(/^\d+-/, "").slice(0, 255) || "propuesta.pdf";
}

async function requireBorrador(tenderId: string) {
  const tender = await db.tender.findUnique({ where: { id: tenderId } });
  if (!tender) throw new DomainError("NOT_FOUND", "Licitación no encontrada");
  if (tender.status !== "borrador") {
    throw new DomainError(
      "NOT_EDITABLE",
      `El documento solo se puede modificar en borrador (estado actual: ${tender.status})`,
    );
  }
  return tender;
}

export async function createUploadUrl(tenderId: string, input: UploadUrlInput) {
  await requireBorrador(tenderId);
  if (input.contentType !== "application/pdf") {
    throw new DomainError("VALIDATION", "El documento debe ser un PDF (application/pdf)");
  }
  if (input.size > MAX_PROPOSAL_SIZE) {
    throw new DomainError("VALIDATION", "El documento supera el máximo de 10 MB");
  }
  const path = `tenders/${tenderId}/${Date.now()}-${sanitizeFileName(input.fileName)}`;
  const signed = await createSignedUploadUrl(path);
  return { path: signed.path, token: signed.token };
}

export async function confirmUpload(tenderId: string, path: string, userId: string) {
  const tender = await requireBorrador(tenderId);

  if (!path.startsWith(`tenders/${tenderId}/`)) {
    throw new DomainError("VALIDATION", "El path no pertenece a esta licitación");
  }

  const info = await fileInfo(path);
  if (!info) throw new DomainError("NOT_FOUND", "El archivo subido no existe en Storage");
  if (info.size <= 0 || info.size > MAX_PROPOSAL_SIZE) {
    throw new DomainError("VALIDATION", "Tamaño de archivo inválido o superior a 10 MB");
  }
  if (info.contentType && info.contentType !== "application/pdf") {
    throw new DomainError("VALIDATION", "El archivo en Storage no es un PDF");
  }

  const oldPath = tender.proposalPath;
  const url = publicUrl(path);

  // Primero la referencia en BD, después limpiar Storage:
  // un huérfano es menos grave que una referencia rota.
  const updated = await db.tender.update({
    where: { id: tenderId },
    data: {
      proposalPath: path,
      proposalUrl: url,
      proposalName: displayName(path),
      proposalSize: info.size,
      updatedById: userId,
    },
  });

  if (oldPath && oldPath !== path) {
    try {
      await removeFile(oldPath);
    } catch (err) {
      console.warn("[proposal] no se pudo eliminar el archivo anterior:", err);
    }
  }

  return updated;
}

/**
 * Sube el PDF directamente por nuestra API (proxy): el navegador no dispone
 * de una credencial valida para firmar URLs de subida en Supabase Storage.
 */
export async function uploadProposal(
  tenderId: string,
  body: Buffer,
  fileName: string,
  userId: string,
) {
  await requireBorrador(tenderId);
  if (body.length === 0) {
    throw new DomainError("VALIDATION", "El documento esta vacio");
  }
  if (body.length > MAX_PROPOSAL_SIZE) {
    throw new DomainError("VALIDATION", "El documento supera el maximo de 10 MB");
  }
  if (!looksLikePdf(body)) {
    throw new DomainError("VALIDATION", "El documento debe ser un PDF (application/pdf)");
  }

  const path = `tenders/${tenderId}/${Date.now()}-${sanitizeFileName(fileName)}`;
  await uploadPdf(path, body);
  try {
    return await confirmUpload(tenderId, path, userId);
  } catch (err) {
    await removeFile(path).catch(() => undefined);
    throw err;
  }
}
