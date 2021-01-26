import type { Location } from 'history';
import type { IdTokenClaims, UserinfoResponse } from 'openid-client';
import * as React from 'react';
import { useLocation } from '../routing';
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

export function useAuth(): ClientAuth {
  const authContext = React.useContext(AuthContext);
  const location = useLocation();
  const redirectTo = locationToString(location);

  return {
    ...authContext,
    loginUrl: `${authContext.loginUrl}?return_to=${encodeURIComponent(redirectTo)}`,
    logoutUrl: `${authContext.logoutUrl}?return_to=${encodeURIComponent(redirectTo)}`,
  };
}

interface KnownUserFields {
  email: string;
  email_verified: boolean;
  sub: string;
  updated_at: string;
}

export type NostalgieUser = KnownUserFields & { [field: string]: unknown };

function locationToString(location: Location): string {
  const queryString = location.search ? `?${location.search}` : '';
  const hashString = location.hash ? `#${location.hash}` : '';

  return `${location.pathname || ''}${queryString}${hashString}`;
}
