/// <reference types="vite/client" />

import type { FerroAPI } from "../shared/types";

declare global {
  interface Window {
    ferroAPI: FerroAPI;
  }
}
