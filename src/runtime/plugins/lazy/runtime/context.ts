import * as React from 'react';
import { LazyManager } from './manager';

export const LazyContext = React.createContext(new LazyManager());
