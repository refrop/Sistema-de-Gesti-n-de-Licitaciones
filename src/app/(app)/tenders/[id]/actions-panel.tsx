"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FileUp, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api, apiFetch, errorMessage } from "@/lib/api";
import { formatDateTime, formatSize } from "@/lib/format";
import type { SerializedTender } from "@/lib/tender-serialize";

const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

export function ActionsPanel({ tender }: { tender: SerializedTender }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);

  const isDraft = tender.status === "borrador";
  const proposal = tender.proposal;

  async function upload() {
    if (uploading) return;
    if (!file) {
      toast.error("Selecciona un PDF");
      return;
    }
    if ((file.type && file.type !== "application/pdf") || !/\.pdf$/i.test(file.name)) {
      toast.error("El documento debe ser un PDF");
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      toast.error(`El archivo supera el limite de ${formatSize(MAX_UPLOAD_BYTES)}`);
      return;
    }
    setUploading(true);
    try {
      await apiFetch(`/api/tenders/${tender.id}/proposal/upload`, {
        method: "POST",
        headers: {
          "content-type": "application/pdf",
          "x-file-name": encodeURIComponent(file.name),
        },
        body: file,
      });
      toast.success("Documento guardado");
      setFile(null);
      if (inputRef.current) inputRef.current.value = "";
      router.refresh();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setUploading(false);
    }
  }

  async function send() {
    if (sending) return;
    setSending(true);
    try {
      await api.post(`/api/tenders/${tender.id}/send`);
      toast.success("Licitacion enviada al cliente");
      router.refresh();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle>Documento</CardTitle>
          {proposal && <span className="text-xs text-muted-foreground">{formatSize(proposal.size)}</span>}
        </CardHeader>
        <CardContent className="space-y-4">
          {proposal ? (
            <a
              href={proposal.url}
              target="_blank"
              rel="noreferrer"
              className="block truncate text-sm font-medium text-primary hover:underline"
            >
              {proposal.name}
            </a>
          ) : (
            <p className="text-sm text-muted-foreground">Sin documento de propuesta.</p>
          )}

          {isDraft && (
            <>
              <input
                ref={inputRef}
                id="proposal-file"
                type="file"
                accept="application/pdf"
                className="block w-full text-sm file:mr-3 file:rounded-md file:border file:border-input file:bg-background file:px-3 file:py-1.5 file:text-sm file:font-medium hover:file:bg-accent"
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              />
              {file && (
                <p className="text-xs text-muted-foreground">
                  Seleccionado: {file.name} · {formatSize(file.size)}
                </p>
              )}
              <Button
                type="button"
                className="w-full"
                disabled={uploading || !file}
                onClick={() => void upload()}
              >
                <FileUp />
                {uploading ? "Subiendo…" : proposal ? "Reemplazar documento" : "Subir documento"}
              </Button>
              <p className="text-xs text-muted-foreground">
                PDF de hasta {formatSize(MAX_UPLOAD_BYTES)}.
              </p>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Envio</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {tender.sentAt ? (
            <p className="text-sm text-muted-foreground">
              Enviado el {formatDateTime(tender.sentAt)}.
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              Se enviara por correo a {tender.client.email} con el documento adjunto.
            </p>
          )}
          {isDraft && (
            <>
              <Button
                type="button"
                className="w-full"
                disabled={sending || !proposal}
                onClick={() => void send()}
              >
                <Send />
                {sending ? "Enviando…" : "Enviar licitacion"}
              </Button>
              {!proposal && (
                <p className="text-xs text-muted-foreground">
                  Sube el documento antes de enviar.
                </p>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
