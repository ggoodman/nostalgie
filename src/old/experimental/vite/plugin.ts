import type { ServerPlugin } from '../serverPlugin';

export function vitePlugin(): ServerPlugin {
  return {
    name: 'vite-plugin',
    renderHtml(ctx, document) {
      const reactRefreshEl = document.createElement('script');
      reactRefreshEl.appendChild(
        document.createTextNode(
          `
import RefreshRuntime from "http://localhost:3000/@react-refresh"
RefreshRuntime.injectIntoGlobalHook(window) 
window.$RefreshReg$ = () => {}
window.$RefreshSig$ = () => (type) => type
window.__vite_plugin_react_preamble_installed__ = true
      `.trim()
        )
      );
      reactRefreshEl.setAttribute('type', 'module');
      document.head.appendChild(reactRefreshEl);
      const viteClientEl = document.createElement('script');
      viteClientEl.setAttribute('src', '/@vite/client');
      viteClientEl.setAttribute('type', 'module');
      document.head.appendChild(viteClientEl);
    },
  };
}
