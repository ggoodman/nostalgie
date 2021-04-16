import type { ChunkManager, LazyComponentState } from './types';

function exportedComponent(mod: any) {
  return Object.hasOwnProperty.call(mod, 'default') ? (mod as any).default : mod;
}

export function register(
  chunkManager: ChunkManager,
  chunk: string | undefined,
  lazyImport: string,
  mod: any
) {
  const component = exportedComponent(mod);
  const lazyComponentState: LazyComponentState = {
    state: 'loaded',
    component,
  };

  if (process.env.NOSTALGIE_BUILD_TARGET === 'server') {
    if (chunk) {
      chunkManager.chunks.push({ chunk, lazyImport });
    }
  }

  chunkManager.lazyComponentState.set(lazyImport, lazyComponentState);

  return lazyComponentState;
}
