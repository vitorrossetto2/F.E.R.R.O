/// <reference types="vite/client" />

import type { FerroAPI } from "../preload/index.js";

declare global {
  interface Window {
    ferroAPI: FerroAPI;
  }
}
