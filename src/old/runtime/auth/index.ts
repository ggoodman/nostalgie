import type { Location } from 'history';
import type { IdTokenClaims, UserinfoResponse } from 'openid-client';
import * as React from 'react';
import { useLocation } from '../routing';
import { AuthContext } from './server';

export interface CreateLogoutUrlOptions {
  /**
   * The path to which you would like to return after the logout flow
   */
  returnTo?: string;
}

export interface ClientAuthAuthenticated {
  isAuthenticated: true;
  credentials: {
    audience?: string;
    claims: IdTokenClaims;
    scope: string[];
    user: UserinfoResponse;
    idToken: string;
    accessToken: string;
  };
  loginUrl: string;
  logoutUrl: string;
}

export interface ClientAuthAuthenticatedApi extends ClientAuthAuthenticated {
  createLoginUrl(options?: CreateLoginUrlOptions): string;
  createLogoutUrl(options?: CreateLogoutUrlOptions): string;
}

export interface CreateLoginUrlOptions {
  /**
   * The audience (aud claim) for which you wish to obtain an access token
   */
  audience?: string;

  /**
   * The path to which you would like to return after the login flow
   */
  returnTo?: string;

  /**
   * A set of scopes to request
   */
  scope?: string[];
}

export interface ClientAuthUnauthenticated {
  isAuthenticated: false;
  error?: unknown;
  loginUrl: string;
  logoutUrl: string;
}

export interface ClientAuthUnauthenticatedApi extends ClientAuthUnauthenticated {
  createLoginUrl(options?: CreateLoginUrlOptions): string;
}

export type ClientAuth = ClientAuthAuthenticated | ClientAuthUnauthenticated;
export type ClientAuthApi = ClientAuthAuthenticatedApi | ClientAuthUnauthenticatedApi;

export function useAuth(): ClientAuthAuthenticatedApi | ClientAuthUnauthenticatedApi {
  const authContext = React.useContext(AuthContext);
  const location = useLocation();
  const redirectTo = locationToString(location);

  if (authContext.isAuthenticated) {
    return {
      ...authContext,
      createLoginUrl(options = {}) {
        const query = [`return_to=${encodeURIComponent(options.returnTo || redirectTo)}`];

        if (options.audience) {
          query.push(`audience=${encodeURIComponent(options.audience)}`);
        }

        if (Array.isArray(options.scope)) {
          query.push(`scope=${encodeURIComponent(options.scope.join(' '))}`);
        }

        return `${authContext.loginUrl}?${query.join('&')}`;
      },
      createLogoutUrl(options = {}) {
        const query = [`return_to=${encodeURIComponent(options.returnTo || redirectTo)}`];

        return `${authContext.loginUrl}?${query.join('&')}`;
      },
    };
  }

  return {
    ...authContext,
    createLoginUrl(options = {}) {
      const query = [`return_to=${encodeURIComponent(options.returnTo || redirectTo)}`];

      if (options.audience) {
        query.push(`audience=${encodeURIComponent(options.audience)}`);
      }

      if (Array.isArray(options.scope)) {
        query.push(`scope=${encodeURIComponent(options.scope.join(' '))}`);
      }

      return `${authContext.loginUrl}?${query.join('&')}`;
    },
  };
}

export interface UseRequiredAuthOptions {
  audience?: string;
  scope?: string[];
}

export function useAuthorized(
  options?: UseRequiredAuthOptions
): ClientAuth & { isAuthorized: boolean } {
  const authContext = React.useContext(AuthContext);
  const location = useLocation();
  const redirectTo = locationToString(location);
  const query = [`return_to=${encodeURIComponent(redirectTo)}`];

  if (options?.audience) {
    query.push(`audience=${encodeURIComponent(options.audience)}`);
  }

  if (options?.scope) {
    query.push(`scope=${encodeURIComponent(options.scope.join(' '))}`);
  }

  if (!authContext.isAuthenticated) {
    // history.replace(`${authContext.loginUrl}?${query.join('&')}`);
    return {
      ...authContext,
      isAuthorized: false,
    };
  }

  // Check audience requirement if present
  if (
    typeof options?.audience === 'string' &&
    authContext.credentials.claims.aud !== options.audience
  ) {
    // history.replace(`${authContext.loginUrl}?${query.join('&')}`);
    return {
      ...authContext,
      isAuthorized: false,
    };
  }

  const scopes = new Set(authContext.credentials.scope);

  // Check scope requirement if present
  if (
    Array.isArray(options?.scope) &&
    !options?.scope.every((requiredScope) => scopes.has(requiredScope))
  ) {
    // history.replace(`${authContext.loginUrl}?${query.join('&')}`);
    return {
      ...authContext,
      isAuthorized: false,
    };
  }

  return {
    ...authContext,
    isAuthorized: true,
  };
}

export interface WithAuthenticationRequiredOptions {
  audience?: string;
  fallback?: React.FC<{ loginUrl: string }>;
  scope?: string[];
}

export function withAuthenticationRequired<P extends {}>(
  Component: React.ComponentType<P>,
  options: WithAuthenticationRequiredOptions = {}
) {
  function handleFallback(authState: ClientAuthApi) {
    const loginUrl = authState.createLoginUrl({
      audience: options.audience,
      scope: options.scope,
    });

    if (options.fallback) {
      return options.fallback({ loginUrl });
    }

    window.location.href = loginUrl;

    // Control should never reach here.
    throw new Error('Invariant violation: Window expected to have synchronously navigated');
  }

  return function WithAuthenticationRequired(props: P) {
    const authState = useAuth();

    if (!authState.isAuthenticated) {
      return handleFallback(authState);
    }

    if (options.audience && options.audience !== authState.credentials.audience) {
      return handleFallback(authState);
    }

    if (Array.isArray(options.scope) && options.scope.length) {
      const accessTokenScopes = new Set(authState.credentials.scope);

      if (!options.scope.every((requiredScope) => accessTokenScopes.has(requiredScope))) {
        return handleFallback(authState);
      }
    }

    return React.createElement(Component, props);
  };
}

export type NostalgieUser = UserinfoResponse;

function locationToString(location: Location): string {
  const queryString = location.search ? `?${location.search}` : '';
  const hashString = location.hash ? `#${location.hash}` : '';

  return `${location.pathname || ''}${queryString}${hashString}`;
}
