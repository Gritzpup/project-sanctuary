/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_COPILOT_ACCESS_TOKEN?: string;
  readonly VITE_DEBUG?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
