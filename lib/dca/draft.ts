import {z} from "zod";
export const dcaDraftSchema=z.object({amount:z.number().finite().min(10).max(100000),budget:z.number().finite().min(10).max(1000000),btcPercent:z.number().int().min(0).max(100),frequency:z.enum(["daily","weekly","monthly"]),startAt:z.iso.datetime()}).refine(p=>p.budget>=p.amount,"Budget must cover a purchase");
export type DCADraft=z.infer<typeof dcaDraftSchema>;
