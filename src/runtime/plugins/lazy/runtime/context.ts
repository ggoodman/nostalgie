import * as React from 'react';
import type { LazyManager } from './manager';

export const LazyContext = React.createContext<LazyManager | null>(null);
