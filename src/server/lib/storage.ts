import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "./env";

let client: SupabaseClient | undefined;

export function supabase(): SupabaseClient {
  if (!client) {
    client = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
}

export async function ensureBucket(): Promise<void> {
  const sb = supabase();
  const { error } = await sb.storage.createBucket(env.SUPABASE_BUCKET, {
    public: true,
    fileSizeLimit: 10 * 1024 * 1024,
    allowedMimeTypes: ["application/pdf"],
  });
  if (error && !/already exists|duplicate/i.test(error.message)) {
    throw new Error(`No se pudo crear el bucket "${env.SUPABASE_BUCKET}": ${error.message}`);
  }
}

export async function uploadPdf(
  path: string,
  body: Buffer,
): Promise<{ path: string; publicUrl: string }> {
  const bucket = supabase().storage.from(env.SUPABASE_BUCKET);
  const { error } = await bucket.upload(path, body, {
    contentType: "application/pdf",
    upsert: false,
  });
  if (error) throw new Error(`Fallo al subir el PDF a Storage: ${error.message}`);
  const { data } = bucket.getPublicUrl(path);
  return { path, publicUrl: data.publicUrl };
}

export async function removeFile(path: string): Promise<void> {
  const { error } = await supabase().storage.from(env.SUPABASE_BUCKET).remove([path]);
  if (error) throw new Error(`Fallo al eliminar el archivo de Storage: ${error.message}`);
}
