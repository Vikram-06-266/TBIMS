import { Router } from "express";
import { z } from "zod";
import { requireAuthentication, requireRoles } from "../middleware/authentication.js";
import { ProductServiceError } from "../services/product-service.js";

const filtersSchema = z
  .object({
    sku: z.string().trim().min(1).optional(),
    name: z.string().trim().min(1).optional(),
    category: z.string().trim().min(1).optional(),
    lowStock: z.enum(["true", "false"]).transform((value) => value === "true").optional(),
  })
  .strict();

const unitPriceSchema = z.union([
  z.string().regex(/^\d{1,10}(?:\.\d{1,2})?$/),
  z
    .number()
    .finite()
    .nonnegative()
    .max(9_999_999_999.99)
    .transform(String)
    .pipe(z.string().regex(/^\d{1,10}(?:\.\d{1,2})?$/)),
]);

const productInputSchema = z
  .object({
    sku: z.string().trim().min(1),
    name: z.string().trim().min(1),
    category: z.string().trim().min(1).nullable().optional(),
    unit_price: unitPriceSchema,
  })
  .strict();

export function createProductRouter(productService, authService) {
  const router = Router();
  router.use(requireAuthentication(authService));

  router.get(
    "/",
    requireRoles("owner", "admin", "inventoryManager", "staff"),
    async (req, res, next) => {
      const parsedFilters = filtersSchema.safeParse(req.query);
      if (!parsedFilters.success) {
        return next(new ProductServiceError("INVALID_PRODUCT_QUERY"));
      }

      try {
        const products = await productService.listProducts(parsedFilters.data);
        return res.json({
          ok: true,
          data: { products },
          requestId: req.requestId,
        });
      } catch (error) {
        return next(error);
      }
    },
  );

  router.post(
    "/",
    requireRoles("owner", "admin", "inventoryManager"),
    async (req, res, next) => {
      const parsedProduct = productInputSchema.safeParse(req.body);
      if (!parsedProduct.success) {
        return next(new ProductServiceError("INVALID_PRODUCT_INPUT"));
      }

      try {
        const product = await productService.createProduct(parsedProduct.data);
        return res.status(201).json({
          ok: true,
          data: { product },
          requestId: req.requestId,
        });
      } catch (error) {
        return next(error);
      }
    },
  );

  router.put(
    "/:id",
    requireRoles("owner", "admin", "inventoryManager"),
    async (req, res, next) => {
      try {
        const id = parseInt(req.params.id, 10);
        const { name, unit_price, sku } = req.body || {};
        const product = await productService.updateProduct({
          id: Number.isInteger(id) ? id : null,
          sku,
          name,
          unit_price,
        });
        return res.json({
          ok: true,
          data: { product },
          requestId: req.requestId,
        });
      } catch (error) {
        return next(error);
      }
    },
  );

  return router;
}
