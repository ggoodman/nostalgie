import Boom from '@hapi/boom';
import * as Cookie from '@hapi/cookie';
import type { Plugin, Request } from '@hapi/hapi';
import Joi from 'joi';
import * as OpenID from 'openid-client';
import { URL } from 'url';
import type { NostalgieAuthOptions } from '../../../../settings';
import type { ServerAuthCredentials } from '../../../auth/server';

const AuthState = Joi.object({
  nonce: Joi.string().required(),
  returnTo: Joi.string().required(),
});

interface AuthState {
  nonce: string;
  returnTo: string;
}

interface ServerAuthSession {
  accessToken: string;
  expiresAt: number;
  idToken: string;
  refreshToken?: string;
  scope?: string;
}

export const authPlugin: Plugin<{ auth: NostalgieAuthOptions; publicUrl: string }> = {
  name: 'nostalgie/auth',
  dependencies: ['hapi-pino'],
  async register(server, options) {
    const { auth } = options;
    await server.register(Cookie);

    server.logger.trace(options, 'starting auth module');

    server.auth.strategy('nostalgie-session', 'cookie', {
      cookie: {
        name: 'nsid',
        encoding: 'iron',
        ttl: 1000 * 60 * 60 * 24 * 7 * 4, // 4 weeks
        password: auth.cookieSecret,
        path: '/',
        isSecure: process.env.NODE_ENV !== 'development',
      },
      keepAlive: true,
      validateFunc: async (_request, session: ServerAuthSession) => {
        let tokenSet = new OpenID.TokenSet({
          access_token: session.accessToken,
          expires_at: session.expiresAt,
          id_token: session.idToken,
          refresh_token: session.refreshToken,
          scope: session.scope,
        });

        if (tokenSet.expired()) {
          if (tokenSet.refresh_token) {
            const issuer = await fetchIssuerWithCache(auth.issuer);
            const client = new issuer.Client({
              client_id: auth.clientId,
              client_secret: auth.clientSecret,
            });

            try {
              const oldTokenSet = tokenSet;

              tokenSet = await client.refresh(tokenSet);

              session.accessToken = tokenSet.access_token!;
              session.idToken = tokenSet.id_token!;
              session.expiresAt = tokenSet.expires_at!;
              session.refreshToken = tokenSet.refresh_token || oldTokenSet.refresh_token;
            } catch (err) {
              server.logger.debug(
                {
                  err,
                },
                'error refreshing tokens'
              );

              return {
                valid: false,
              };
            }
          } else {
            return {
              valid: false,
            };
          }
        }

        const user = await fetchUserProfileWithCache(session.accessToken);
        const credentials: ServerAuthCredentials = {
          accessToken: session.accessToken,
          idToken: session.idToken,
          expiresAt: session.expiresAt,
          claims: tokenSet.claims(),
          scope: typeof tokenSet.scope === 'string' ? tokenSet.scope.split(/\s+/) : [],
          user,
        };

        return {
          valid: true,
          credentials,
        };
      },
    });

    // Set as the default auth handler. Routes should explicitly opt out if then don't
    // want auth.
    server.auth.default({
      strategy: 'nostalgie-session',
      mode: 'optional',
    });

    server.state('nauth', {
      encoding: 'iron',
      password: auth.cookieSecret,
      path: '/',
      isSecure: process.env.NODE_ENV !== 'development',
      isHttpOnly: true,
      ttl: null, // Session lifetime
      isSameSite: 'Lax',
    });

    // Issuer fetching
    function fetchIssuer(issuer: string) {
      return OpenID.Issuer.discover(issuer);
    }
    server.method('fetchIssuerWithCache', fetchIssuer, {
      cache: {
        //@ts-ignore
        cache: 'memory',
        generateTimeout: 5000,
        expiresIn: 30000,
        staleIn: 10000,
        staleTimeout: 100,
      },
    });
    const fetchIssuerWithCache: typeof OpenID.Issuer.discover = server.methods.fetchIssuerWithCache;

    async function fetchUserProfile(accessToken: string) {
      const issuer = await fetchIssuerWithCache(auth.issuer);
      const client = new issuer.Client({
        client_id: auth.clientId,
      });
      const userInfo = await client.userinfo(accessToken);

      return userInfo;
    }

    server.method('fetchUserProfileWithCache', fetchUserProfile, {
      cache: {
        //@ts-ignore
        cache: 'memory',
        generateTimeout: 5000,
        expiresIn: 30000,
        staleIn: 10000,
        staleTimeout: 100,
      },
    });
    const fetchUserProfileWithCache: typeof fetchUserProfile =
      server.methods.fetchUserProfileWithCache;

    server.route({
      method: 'GET',
      path: '/.nostalgie/login',
      options: {
        auth: {
          strategy: 'nostalgie-session',
          mode: 'try',
        },
        cors: false,
        validate: {
          query: Joi.object({
            return_to: Joi.string().default('/'),
            scope: Joi.string(),
            audience: Joi.string().uri(),
          }).optional(),
        },
      },
      handler: async (request, h) => {
        const returnTo = validateReturnTo(request, request.query.return_to);
        const issuer = await fetchIssuerWithCache(auth.issuer);
        const client = new issuer.Client({
          client_id: auth.clientId,
          redirect_uris: [`${server.info.uri}/.nostalgie/callback`],
          response_types: ['code'],
        });
        const nonce = OpenID.generators.nonce();
        const requestedScope = new Set(
          request.query.scope ? request.query.scope.split(/\s+/) : undefined
        );

        requestedScope.add('openid');
        // Let's get their email
        requestedScope.add('email');
        // We want to be able to request the user profile
        requestedScope.add('profile');
        // Ask for a refresh token
        requestedScope.add('offline_access');

        const url = client.authorizationUrl({
          audience: request.query.audience,
          scope: [...requestedScope].join(' '),
          response_mode: 'query',
          nonce,
        });

        request.logger.info(
          {
            returnTo,
          },
          'Starting login transaction'
        );

        h.state('nauth', { nonce, returnTo });

        return h.redirect(url);
      },
    });

    server.route({
      method: 'GET',
      path: '/.nostalgie/logout',
      options: {
        auth: {
          strategy: 'nostalgie-session',
          mode: 'try',
        },
        cors: false,
        validate: {
          query: Joi.object({
            return_to: Joi.string().default('/'),
          }).optional(),
        },
      },
      handler: async (request, h) => {
        // const issuer = await fetchIssuerWithCache(auth.issuer);
        // const client = new issuer.Client({
        //   client_id: auth.clientId,
        //   return_tos: [`${server.info.uri}/.nostalgie/callback`],
        //   response_types: ['code'],
        // });
        // const tokenSet = new OpenID.TokenSet({
        //   access_token: (request.auth.credentials.user as any).accessToken,
        //   id_token: (request.auth.credentials.user as any).idToken,
        //   refresh_token: (request.auth.credentials.user as any).refreshToken,
        //   expires_at: (request.auth.credentials.user as any).expiresAt,
        //   expires_in: (request.auth.credentials.user as any).expiresIn,
        // });
        // const endSessionUrl = client.endSessionUrl({
        //   id_token_hint: tokenSet,
        //   post_logout_return_to: '/',
        // });

        const returnTo = validateReturnTo(request, request.query.return_to);

        request.logger.info(
          {
            claims: {
              aud: (request.auth.credentials as any)?.claims.aud,
              iss: (request.auth.credentials as any)?.claims.iss,
              exp: (request.auth.credentials as any)?.claims.exp,
              iat: (request.auth.credentials as any)?.claims.iat,
              sub: (request.auth.credentials as any)?.claims.sub,
            },
            returnTo,
          },
          'Logged out'
        );
        request.cookieAuth.clear();

        return h.redirect(returnTo).unstate('nauth');
      },
    });

    server.route({
      method: 'GET',
      path: '/.nostalgie/callback',
      options: {
        auth: {
          strategy: 'nostalgie-session',
          mode: 'try',
        },
        cors: false,
        state: {
          parse: true,
          failAction: 'error',
        },
      },
      handler: async (request, h) => {
        if (request.auth.isAuthenticated) {
          return h.redirect('/');
        }

        const nauthState = request.state.nauth;
        // Clear the session cookie now that it has been consumed
        h.unstate('nauth');

        const validationResult = AuthState.validate(nauthState, {
          stripUnknown: true,
        });

        if (validationResult.error) {
          request.logger.warn(
            {
              err: validationResult.error,
            },
            'Error while validating authentication state cookie payload'
          );

          throw Boom.badImplementation();
        }

        const nauth = validationResult.value as AuthState;
        const returnTo = validateReturnTo(request, nauth.returnTo);
        const redirectUri = `${server.info.uri}/.nostalgie/callback`;
        const issuer = await fetchIssuerWithCache(auth.issuer);
        const client = new issuer.Client({
          client_id: auth.clientId,
          client_secret: auth.clientSecret,
          redirect_uris: [redirectUri],
          // response_types: ['id_token token'],
        });
        const params = client.callbackParams({
          method: request.raw.req.method!,
          url: request.raw.req.url!,
          body: request.payload,
        } as any);

        const tokenSet = await client.callback(redirectUri, params, {
          nonce: nauth.nonce,
        });

        if (!tokenSet.access_token) {
          request.logger.warn(
            { issuer: auth.issuer },
            'received a token set lacking an access_token'
          );
          throw Boom.badImplementation();
        }

        if (!tokenSet.id_token) {
          request.logger.warn({ issuer: auth.issuer }, 'received a token set lacking an id_token');
          throw Boom.badImplementation();
        }

        if (!tokenSet.expires_at) {
          request.logger.warn(
            { issuer: auth.issuer },
            'received a token set lacking an expires_at'
          );
          throw Boom.badImplementation();
        }

        const serverAuth: ServerAuthSession = {
          accessToken: tokenSet.access_token,
          expiresAt: tokenSet.expires_at,
          idToken: tokenSet.id_token,
          refreshToken: tokenSet.refresh_token,
          scope: tokenSet.scope,
        };

        request.cookieAuth.set(serverAuth);

        const claims = tokenSet.claims();

        request.logger.info(
          {
            claims: {
              aud: claims.aud,
              iss: claims.iss,
              exp: claims.exp,
              iat: claims.iat,
              sub: claims.sub,
            },
            returnTo,
          },
          'Login callback completed'
        );

        return h.redirect(returnTo);
      },
    });
  },
};

function validateReturnTo(request: Request, redirectCandidate: string): string {
  let returnTo = '/';

  try {
    const publicUrlObj = new URL(request.server.info.uri);
    const resolvedUrl = new URL(redirectCandidate, publicUrlObj);

    if (
      publicUrlObj.hostname === resolvedUrl.hostname &&
      publicUrlObj.port === resolvedUrl.port &&
      publicUrlObj.protocol === resolvedUrl.protocol &&
      resolvedUrl.pathname.startsWith(publicUrlObj.pathname)
    ) {
      returnTo = `${resolvedUrl.pathname}?${resolvedUrl.search}`;
    } else {
      request.logger.warn(
        {
          return_to: redirectCandidate,
        },
        'Rejecting unsafe redirect'
      );
    }
  } catch (err) {
    request.logger.warn(
      {
        return_to: redirectCandidate,
      },
      'Rejecting unsafe redirect'
    );
  }

  return returnTo;
}
