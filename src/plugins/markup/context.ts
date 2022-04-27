import { createContext } from 'react';
import type { MarkupManager } from './manager';

export const MarkupContext = createContext<MarkupManager | null>(null);
