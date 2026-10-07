import { Hono } from "hono";
import { z } from "zod";
import { readJsonBody } from "../guard";
import {
  createTenderSchema,
  tenderListQuerySchema,
  createTender,
  listTenders,
  listExpiring,
  getTender,
  listTransitions,
  changeState,
} from "../../services/tenders.service";
import { addProduct, removeProduct } from "../../services/tender-products.service";
import {
  uploadUrlSchema,
  confirmSchema,
  createUploadUrl,
  confirmUpload,
} from "../../services/proposal.service";
import { sendTender } from "../../services/tender-send.service";

const addProductSchema = z.object({
  productId: z.string().min(1, "productId obligatorio"),
  quantity: z.number().int().min(1, "quantity debe ser al menos 1"),
});

const expiringQuerySchema = z.object({
  days: z.coerce.number().int().min(0).max(365).default(3),
});

export const tenderRoutes = new Hono()
  .get("/api/tenders", async (c) => {
    const query = tenderListQuerySchema.parse(c.req.query());
    return c.json(await listTenders(query));
  })
  .get("/api/tenders/expiring", async (c) => {
    const { days } = expiringQuerySchema.parse(c.req.query());
    return c.json(await listExpiring(days));
  })
  .post("/api/tenders", async (c) => {
    const body = await readJsonBody(c, createTenderSchema);
    const tender = await createTender(body, c.get("user").id);
    return c.json(tender, 201);
  })
  .get("/api/tenders/:id", async (c) => c.json(await getTender(c.req.param("id"))))
  .get("/api/tenders/:id/transitions", async (c) =>
    c.json(await listTransitions(c.req.param("id"))),
  )
  .post("/api/tenders/:id/products", async (c) => {
    const body = await readJsonBody(c, addProductSchema);
    const row = await addProduct(
      c.req.param("id"),
      body.productId,
      body.quantity,
      c.get("user").id,
    );
    return c.json(row, 201);
  })
  .delete("/api/tenders/:id/products/:productId", async (c) => {
    await removeProduct(c.req.param("id"), c.req.param("productId"));
    return c.json({ ok: true });
  })
  .post("/api/tenders/:id/proposal/upload-url", async (c) => {
    const body = await readJsonBody(c, uploadUrlSchema);
    return c.json(await createUploadUrl(c.req.param("id"), body));
  })
  .post("/api/tenders/:id/proposal/confirm", async (c) => {
    const body = await readJsonBody(c, confirmSchema);
    const tender = await confirmUpload(c.req.param("id"), body.path, c.get("user").id);
    return c.json(tender);
  })
  .post("/api/tenders/:id/send", async (c) => {
    const tender = await sendTender(c.req.param("id"), c.get("user").id);
    return c.json(tender);
  })
  .post("/api/tenders/:id/finalize", async (c) => {
    const tender = await changeState(c.req.param("id"), "finalizada", c.get("user").id, "manual");
    return c.json(tender);
  })
  .post("/api/tenders/:id/lose", async (c) => {
    const tender = await changeState(c.req.param("id"), "perdida", c.get("user").id, "manual");
    return c.json(tender);
  });
