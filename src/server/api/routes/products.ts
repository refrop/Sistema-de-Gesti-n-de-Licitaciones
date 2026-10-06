import { Hono } from "hono";
import { z } from "zod";
import { readJsonBody } from "../guard";
import { listQuerySchema } from "../../lib/pagination";
import { listProducts, createProduct } from "../../services/products.service";

const createProductSchema = z.object({
  name: z.string().trim().min(1, "Nombre obligatorio"),
  sku: z.string().trim().min(1, "SKU obligatorio"),
  description: z.string().trim().min(1).optional(),
  basePrice: z.number().min(0, "Precio base no puede ser negativo"),
});

export const productRoutes = new Hono()
  .get("/api/products", async (c) => {
    const query = listQuerySchema.parse(c.req.query());
    return c.json(await listProducts(query));
  })
  .post("/api/products", async (c) => {
    const body = await readJsonBody(c, createProductSchema);
    const product = await createProduct(body, c.get("user").id);
    return c.json(product, 201);
  });
