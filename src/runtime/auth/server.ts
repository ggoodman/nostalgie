import type { RequestAuth } from '@hapi/hapi';
import * as React from 'react';
import type { ClientAuth } from './';

export interface ServerAuth extends RequestAuth {}

export const AuthContext = React.createContext<ClientAuth>({
  isAuthentiated: false,
  isAuthorized: false,
  loginUrl: '/.nostalgie/login',
  logoutUrl: '/.nostalgie/logout',
});
