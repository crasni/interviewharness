/// <reference types="vite/client" />
import type { HarnessApi } from '../../shared/api.ts';

declare global {
  interface Window {
    harness: HarnessApi;
  }
}
