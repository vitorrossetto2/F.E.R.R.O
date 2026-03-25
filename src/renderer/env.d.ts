/// <reference types="vite/client" />

import type { MicaAPI } from "../preload/index.js";

declare global {
  interface Window {
    micaAPI: MicaAPI;
  }
}
