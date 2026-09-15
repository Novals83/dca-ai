export async function register() {
 if(process.env.NEXT_RUNTIME === "nodejs" && process.env.DCA_WORKER_ENABLED === "1") {
  const {startWorker}=await import("./lib/dca/runtime/engine");startWorker();
 }
}
