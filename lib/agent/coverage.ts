import {occurrence,planSummary,type DCAPlan} from "../dca/schedule";
// Include the worker's five-minute execution grace period after the final slot.
export function requiredAgentExpiry(plan:DCAPlan) {
 return Date.parse(occurrence(plan.startAt,plan.frequency,planSummary(plan).count-1))+300000;
}
export function coversStrategy(localExpiry:number,exchangeExpiry:number|null,required:number) {
 return localExpiry>=required && (exchangeExpiry===null || exchangeExpiry>=required);
}
