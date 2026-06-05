import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { SuiClientProvider, WalletProvider } from '@mysten/dapp-kit';
import { SuiJsonRpcClient, JsonRpcHTTPTransport } from '@mysten/sui/jsonRpc';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '@mysten/dapp-kit/dist/index.css';
import App from './App.tsx';
import './index.css';

const suiNetwork = (import.meta.env.VITE_SUI_NETWORK ?? 'testnet') as 'testnet' | 'mainnet';

const FULLNODE_URLS: Record<string, string> = {
  mainnet: 'https://fullnode.mainnet.sui.io:443',
  testnet: 'https://fullnode.testnet.sui.io:443',
  devnet:  'https://fullnode.devnet.sui.io:443',
};

const queryClient = new QueryClient();

// Create SuiJsonRpcClient for dapp-kit v1.x
const suiJsonRpcClient = new SuiJsonRpcClient({
  transport: new JsonRpcHTTPTransport({ url: FULLNODE_URLS[suiNetwork] ?? FULLNODE_URLS.testnet }),
  network: suiNetwork as 'mainnet' | 'testnet',
});

// Networks map for SuiClientProvider — value is the client itself
const networks = {
  [suiNetwork]: suiJsonRpcClient,
} as const;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <SuiClientProvider
        networks={networks}
        defaultNetwork={suiNetwork}
        createClient={(_name, client) => client as SuiJsonRpcClient}
      >
        <WalletProvider autoConnect>
          <App />
        </WalletProvider>
      </SuiClientProvider>
    </QueryClientProvider>
  </StrictMode>,
);
