/// <reference types="vite/client" />

import type { FerroAPI } from "../preload/index";

declare global {
  interface Window {
    ferroAPI: FerroAPI;
  }
}
