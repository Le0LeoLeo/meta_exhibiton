import { Agent as HttpAgent } from 'node:http';
import { Agent as HttpsAgent } from 'node:https';
import type { ProxyOptions } from 'vite';

export function createDevProxyOptions(target: string): ProxyOptions {
  const Agent = new URL(target).protocol === 'https:' ? HttpsAgent : HttpAgent;
  return {
    target,
    changeOrigin: true,
    // Reuse upstream connections. On the tested Windows/Node environment,
    // one-shot HTTP connections can stall before a large response completes.
    agent: new Agent({ keepAlive: true }),
  };
}
