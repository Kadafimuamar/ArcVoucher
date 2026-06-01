import { http, createConfig } from "wagmi";
import { injected } from "wagmi/connectors";
import { arcTestnet } from "@/lib/chains/arc";

export const wagmiConfig = createConfig({
  chains: [arcTestnet],
  connectors: [injected()],
  ssr: true,
  transports: {
    [arcTestnet.id]: http(arcTestnet.rpcUrls.default.http[0])
  }
});

