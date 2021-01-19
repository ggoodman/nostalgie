import * as React from 'react';
import type { ChunkManager } from './types';

export const LazyContext = React.createContext<ChunkManager | undefined>(undefined);
