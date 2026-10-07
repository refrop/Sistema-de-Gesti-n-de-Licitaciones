import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { app } from "../src/server/api/app";
import { db } from "../src/server/lib/db";
import { supabase, fileInfo } from "../src/server/lib/storage";
import { env } from "../src/server/lib/env";
import { createTender } from "../src/server/services/tenders.service";
import { createUploadUrl, confirmUpload } from "../src/server/services/proposal.service";

const PDF = Buffer.from("%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n");
const createdPaths: string[] = [];

let clientId = "";
let cookie = "";

async function login(): Promise<string> {
  const res = await app.request("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "test-admin@example.com", password: "TestPass123!" }),
  });
  return res.headers.get("set-cookie")!.split(";")[0];
}

const newTender = () =>
  createTender(
    {
      clientId,
      title: "Licitación proposal",
      maxBudget: 10000,
      deadline: new Date(Date.now() + 86_400_000),
    },
    "test-actor",
  );

async function uploadTo(path: string, token: string, body: Buffer) {
  const { error } = await supabase()
    .storage.from(env.SUPABASE_BUCKET)
    .uploadToSignedUrl(path, token, body, { contentType: "application/pdf" });
  if (error) throw new Error(`uploadToSignedUrl falló: ${error.message}`);
}

beforeAll(async () => {
  cookie = await login();
  const client = await db.client.create({
    data: { name: "Cliente Proposal", email: `proposal-${Date.now()}@test.com` },
  });
  clientId = client.id;
});

afterAll(async () => {
  if (createdPaths.length) {
    await supabase().storage.from(env.SUPABASE_BUCKET).remove(createdPaths);
  }
  await db.tender.deleteMany({ where: { clientId } });
  await db.client.delete({ where: { id: clientId } });
  await db.$disconnect();
});

describe("POST /api/tenders/:id/proposal/upload-url", () => {
  it("401 sin sesión", async () => {
    const tender = await newTender();
    const res = await app.request(`/api/tenders/${tender.id}/proposal/upload-url`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fileName: "a.pdf", size: 10, contentType: "application/pdf" }),
    });
    expect(res.status).toBe(401);
  });

  it("400 si no es PDF o supera 10 MB", async () => {
    const tender = await newTender();
    const badType = await app.request(`/api/tenders/${tender.id}/proposal/upload-url`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ fileName: "a.txt", size: 10, contentType: "text/plain" }),
    });
    expect(badType.status).toBe(400);

    const bigSize = await app.request(`/api/tenders/${tender.id}/proposal/upload-url`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ fileName: "a.pdf", size: 11 * 1024 * 1024, contentType: "application/pdf" }),
    });
    expect(bigSize.status).toBe(400);
  });

  it("409 si el estado no es borrador (decisión: documento inmutable tras enviar)", async () => {
    const tender = await newTender();
    await db.tender.update({ where: { id: tender.id }, data: { status: "activa" } });
    await expect(
      createUploadUrl(tender.id, { fileName: "a.pdf", size: 10, contentType: "application/pdf" }),
    ).rejects.toMatchObject({ code: "NOT_EDITABLE", status: 409 });
  });

  it("path seguro bajo tenders/{id}/ y nombre saneado", async () => {
    const tender = await newTender();
    const signed = await createUploadUrl(tender.id, {
      fileName: "Informe final (v2).PDF",
      size: PDF.length,
      contentType: "application/pdf",
    });
    createdPaths.push(signed.path);
    expect(signed.path.startsWith(`tenders/${tender.id}/`)).toBe(true);
    expect(signed.path).toMatch(/^tenders\/[^/]+\/\d+-Informe_final_v2\.pdf$/);
    expect(signed.token).toBeTruthy();
  });
});

describe("flujo real: upload → confirm", () => {
  it("sube el PDF, confirma con tamaño real y obtiene URL pública", async () => {
    const tender = await newTender();
    const signed = await createUploadUrl(tender.id, {
      fileName: "propuesta real.pdf",
      size: 1, // el cliente miente: el servidor usa el tamaño real
      contentType: "application/pdf",
    });
    createdPaths.push(signed.path);
    await uploadTo(signed.path, signed.token, PDF);

    const updated = await confirmUpload(tender.id, signed.path, "test-actor");
    expect(updated.proposalPath).toBe(signed.path);
    expect(updated.proposalSize).toBe(PDF.length); // real, no el declarado
    expect(updated.proposalName).toBe("propuesta_real.pdf");
    expect(updated.proposalUrl).toContain(env.SUPABASE_BUCKET);

    const info = await fileInfo(signed.path);
    expect(info?.size).toBe(PDF.length);
    expect(info?.contentType).toBe("application/pdf");
  });

  it("al confirmar un archivo nuevo borra el anterior (después de guardar en BD)", async () => {
    const tender = await newTender();
    const first = await createUploadUrl(tender.id, {
      fileName: "v1.pdf",
      size: PDF.length,
      contentType: "application/pdf",
    });
    createdPaths.push(first.path);
    await uploadTo(first.path, first.token, PDF);
    await confirmUpload(tender.id, first.path, "test-actor");

    const second = await createUploadUrl(tender.id, {
      fileName: "v2.pdf",
      size: PDF.length,
      contentType: "application/pdf",
    });
    createdPaths.push(second.path);
    await uploadTo(second.path, second.token, PDF);
    const updated = await confirmUpload(tender.id, second.path, "test-actor");

    expect(updated.proposalPath).toBe(second.path);
    expect(await fileInfo(first.path)).toBeNull(); // anterior eliminado
    expect(await fileInfo(second.path)).not.toBeNull();
  });
});

describe("validaciones de confirm", () => {
  it("400 si el path pertenece a otra licitación", async () => {
    const a = await newTender();
    const b = await newTender();
    const signed = await createUploadUrl(a.id, {
      fileName: "x.pdf",
      size: PDF.length,
      contentType: "application/pdf",
    });
    createdPaths.push(signed.path);
    await uploadTo(signed.path, signed.token, PDF);
    await expect(confirmUpload(b.id, signed.path, "test-actor")).rejects.toMatchObject({
      code: "VALIDATION",
      status: 400,
    });
  });

  it("404 si el archivo no existe en Storage", async () => {
    const tender = await newTender();
    await expect(
      confirmUpload(tender.id, `tenders/${tender.id}/999-noexiste.pdf`, "test-actor"),
    ).rejects.toMatchObject({ code: "NOT_FOUND", status: 404 });
  });

  it("409 si el estado cambió a activa (revalidado en confirm)", async () => {
    const tender = await newTender();
    const signed = await createUploadUrl(tender.id, {
      fileName: "y.pdf",
      size: PDF.length,
      contentType: "application/pdf",
    });
    createdPaths.push(signed.path);
    await uploadTo(signed.path, signed.token, PDF);
    await db.tender.update({ where: { id: tender.id }, data: { status: "activa" } });
    await expect(confirmUpload(tender.id, signed.path, "test-actor")).rejects.toMatchObject({
      code: "NOT_EDITABLE",
      status: 409,
    });
  });
});
