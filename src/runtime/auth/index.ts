import * as React from 'react';
import { AuthContext } from './server';

export interface ClientAuth {
  error?: unknown;
  isAuthentiated: boolean;
  isAuthorized: boolean;
  credentials?: {
    scope: string[];
    user: NostalgieUser;
  };
  loginUrl: string;
  logoutUrl: string;
}

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
