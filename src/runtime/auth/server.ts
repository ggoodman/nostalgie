import type { IdTokenClaims, UserinfoResponse } from 'openid-client';
import * as React from 'react';
import type { ClientAuth } from './';

export interface ServerAuthAuthenticated {
  isAuthenticated: true;
  credentials: ServerAuthCredentials;
}

export interface ServerAuthUnauthenticated {
  error?: unknown;
  isAuthenticated: false;
}

export type ServerAuth = ServerAuthAuthenticated | ServerAuthUnauthenticated;

export interface ServerAuthCredentials {
  audience?: string;
  accessToken: string;
  claims: IdTokenClaims;
  expiresAt: number;
  idToken: string;
  scope: string[];
  user: UserinfoResponse;
}

export const AuthContext = React.createContext<ClientAuth>({
  isAuthenticated: false,
  loginUrl: '/.nostalgie/login',
  logoutUrl: '/.nostalgie/logout',
});
