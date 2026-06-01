import { startOrderPaidListener } from "./listeners/orderPaidListener.js";
import { startHttpServer } from "./server/httpServer.js";
import { voucherStore } from "./vouchers/voucherStore.js";

await voucherStore.load();
startHttpServer();
startOrderPaidListener();
