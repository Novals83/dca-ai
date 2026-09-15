import {expect, it} from "vitest";
import {walletError} from "../lib/wallet/error";
it("unwraps the provider reason hidden by the SDK", () => {
 expect(walletError(new Error("Failed to sign", {cause: new Error("Chain ID mismatch\nRequest Arguments: secret")}))).toBe("Failed to sign → Chain ID mismatch");
});
it("recognizes nested user rejection", () => {
 expect(walletError({cause: {cause: {code:4001}}})).toContain("rejected");
});
it("handles cyclic causes", () => {
 const e: {message:string;cause?:unknown}={message:"failure"}; e.cause=e; expect(walletError(e)).toBe("failure");
});
