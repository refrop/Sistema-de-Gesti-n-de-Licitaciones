import { Hono } from "hono";
import { z } from "zod";
import { readJsonBody } from "../guard";
import { listQuerySchema } from "../../lib/pagination";
import { listClients, createClient } from "../../services/clients.service";

const createClientSchema = z.object({
  name: z.string().trim().min(1, "Nombre obligatorio"),
  email: z.email("Correo inválido"),
  phone: z.string().trim().min(1).optional(),
  taxId: z.string().trim().min(1).optional(),
  contactName: z.string().trim().min(1).optional(),
});

export const clientRoutes = new Hono()
  .get("/api/clients", async (c) => {
    const query = listQuerySchema.parse(c.req.query());
    return c.json(await listClients(query));
  })
  .post("/api/clients", async (c) => {
    const body = await readJsonBody(c, createClientSchema);
    const client = await createClient(body, c.get("user").id);
    return c.json(client, 201);
  });
