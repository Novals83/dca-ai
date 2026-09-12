import {it,expect} from "vitest";
import {performance,type LedgerFill} from "../lib/accounting/returns";
const start=Date.parse("2025-01-01T00:00:00Z");
const fill=(overrides:Partial<LedgerFill>={}):LedgerFill=>({id:"1",scope:"manual",quoteId:"q",oid:1,time:start,symbol:"HYPE",quantity:"10",price:"10",fee:"0",feeToken:"USDC",...overrides});
it("calculates a one-year 10% return",()=>{const p=performance([fill()],{HYPE:11},start+365*86400000);expect(p.roiPercent).toBeCloseTo(10);expect(p.aprPercent).toBeCloseTo(10);expect(p.xirrPercent).toBeCloseTo(10);});
it("weights later DCA contributions by their investment time",()=>{const p=performance([fill(),fill({id:"2",time:start+182.5*86400000})],{HYPE:11},start+365*86400000);expect(p.aprPercent).toBeCloseTo(20/150*100);expect(p.xirrPercent).toBeGreaterThan(10);});
it("deducts base-asset fees and adds quote-asset fees",()=>{const p=performance([fill({fee:"0.1",feeToken:"HYPE"}),fill({id:"2",fee:"1"})],{HYPE:10},start+365*86400000);expect(p.investedUSDC).toBe("201");expect(p.holdings.HYPE).toBe("19.9");expect(p.pnlUSDC).toBe("-2");});
it("withholds short-history and incomplete annual returns",()=>{expect(performance([fill()],{HYPE:11},start+1000).aprPercent).toBeNull();expect(performance([fill()],{HYPE:11},start+365*86400000,false).roiPercent).toBeNull();});
it("does not fabricate fee conversions",()=>{expect(performance([fill({fee:"1",feeToken:"UNKNOWN"})],{HYPE:10},start+365*86400000).complete).toBe(false);});
