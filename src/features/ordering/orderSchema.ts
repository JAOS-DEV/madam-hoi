import { z } from "zod";

export const orderSchema = z.object({
  name: z.string().min(1, "required"),
  phone: z
    .string()
    .min(8, "invalidPhone")
    .regex(/^[0-9+\-\s()]+$/, "invalidPhone"),
  email: z.union([z.literal(""), z.string().email("Invalid email")]).optional(),
  deliveryLocation: z.string().min(1, "required"),
  locationLat: z.number({ message: "required" }),
  locationLng: z.number({ message: "required" }),
  notes: z.string().optional(),
  paymentMethod: z.enum(["cash", "bank_transfer"]),
  orderSource: z.enum(["web", "line", "phone", "walk_in", "admin_manual"]).optional(),
  customerId: z.string().optional(),
});

export type OrderSchemaInput = z.infer<typeof orderSchema>;
