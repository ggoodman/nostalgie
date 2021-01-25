import type { IdTokenClaims, UserinfoResponse } from 'openid-client';
import * as React from 'react';
import { AuthContext } from './server';

export interface ClientAuthAuthenticated {
  isAuthentiated: true;
  credentials: {
    claims: IdTokenClaims;
    scope: string[];
    user: UserinfoResponse;
  };
  loginUrl: string;
  logoutUrl: string;
}

export interface ClientAuthUnauthenticated {
  error?: unknown;
  isAuthentiated: false;
  loginUrl: string;
  logoutUrl: string;
}

export type ClientAuth = ClientAuthAuthenticated | ClientAuthUnauthenticated;

export function useAuth() {
  const authContext = React.useContext(AuthContext);

  return authContext;
}

interface KnownUserFields {
  email: string;
  email_verified: boolean;
  sub: string;
  updated_at: string;
}

export type NostalgieUser = KnownUserFields & { [field: string]: unknown };
