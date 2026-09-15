import {z} from "zod";
import {planSchema, type DCAPlan} from "../schedule";
import type {PurchaseRecord} from "../../trading/execute";
export const runtimeInput = z.object({plan:planSchema,slippageBps:z.number().int().min(1).max(100)}).refine(v=>Number.isInteger(Math.round(v.plan.amount*10000)/100) && Number.isInteger(Math.round(v.plan.budget*10000)/100),"Use at most two decimal places");
export type Run = {index:number;dueAt:string;state:"preparing"|"pending"|"result"|"not_sent"|"unknown"|"skipped";quoteId?:string;message?:string;record?:PurchaseRecord};
export type RuntimeStrategy = {seriesId?:string;id:string;plan:DCAPlan;slippageBps:number;status:"running"|"paused"|"blocked"|"completed";nextIndex:number;reservedUSDC:number;createdAt:string;updatedAt:string;runs:Run[];error?:string};
