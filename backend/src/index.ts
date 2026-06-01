import { intentStore } from "./intents/intentStore.js";
import { startIntentReceiverListener } from "./listeners/intentReceiverListener.js";
import { startOrderPaidListener } from "./listeners/orderPaidListener.js";
import { startHttpServer } from "./server/httpServer.js";
import { voucherStore } from "./vouchers/voucherStore.js";

await voucherStore.load();
await intentStore.load();
startHttpServer();
startOrderPaidListener();
startIntentReceiverListener();
