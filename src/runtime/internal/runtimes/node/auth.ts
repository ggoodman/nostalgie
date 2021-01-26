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

export const authPlugin: Plugin<{ auth: NostalgieAuthOptions; publicUrl: string }> = {
  name: 'nostalgie/auth',
  async register(server, options) {
    const { auth } = options;
    await server.register(Cookie);

    server.auth.strategy('nostalgie-session', 'cookie', {
      cookie: {
        name: 'nsid',
        encoding: 'iron',
        ttl: 1000 * 60 * 60 * 24 * 7 * 4, // 4 weeks
        password: auth.cookieSecret,
        path: '/',
        // TODO: FIXME in a way that is dev-friendly
        isSecure: false,
      },
      keepAlive: true,
      validateFunc: async (_request, session: ServerAuthCredentials) => {
        return {
          valid: true,
          credentials: session,
        };
      },
    });

    // Set as the default auth handler. Routes should explicitly opt out if then don't
    // want auth.
    server.auth.default({
      strategy: 'nostalgie-session',
      mode: 'optional',
      entity: 'user',
    });

    server.state('nauth', {
      encoding: 'iron',
      password: auth.cookieSecret,
      path: '/',
      // TODO: FIXME in a way that is dev-friendly
      isSecure: false,
      isHttpOnly: true,
      ttl: null, // Session lifetime
      isSameSite: 'Lax',
    });

    server.method('fetchIssuer', (issuer: string) => OpenID.Issuer.discover(issuer), {
      cache: {
        generateTimeout: 5000,
        expiresIn: 30000,
        staleIn: 10000,
        staleTimeout: 100,
      },
    });
    const fetchIssuer: typeof OpenID.Issuer.discover = server.methods.fetchIssuer;

    server.route({
      method: 'GET',
      path: '/.nostalgie/login',
      options: {
        auth: {
          strategy: 'nostalgie-session',
          mode: 'try',
          entity: 'user',
        },
        cors: false,
        validate: {
          query: Joi.object({
            return_to: Joi.string().default('/'),
          }).optional(),
        },
      },
      handler: async (request, h) => {
        if (request.auth.isAuthenticated) {
          return h.redirect('/');
        }

        const returnTo = validateReturnTo(request, request.query.return_to);
        const issuer = await fetchIssuer(auth.issuer);
        const client = new issuer.Client({
          client_id: auth.clientId,
          redirect_uris: [`${server.info.uri}/.nostalgie/callback`],
          response_types: ['code'],
        });
        const nonce = OpenID.generators.nonce();
        const url = client.authorizationUrl({
          scope: 'openid email profile',
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
          mode: 'required',
          entity: 'user',
        },
        cors: false,
        validate: {
          query: Joi.object({
            return_to: Joi.string().default('/'),
          }).optional(),
        },
      },
      handler: async (request, h) => {
        // const issuer = await fetchIssuer(auth.issuer);
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
            sub: (request.auth.credentials as any).claims.sub,
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
          entity: 'user',
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
        const issuer = await fetchIssuer(auth.issuer);
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

        const userInfo = await client.userinfo(tokenSet.access_token);
        const serverAuth: ServerAuthCredentials = {
          claims: tokenSet.claims(),
          scope: typeof tokenSet.scope === 'string' ? tokenSet.scope.split(/\s+/) : [],
          user: userInfo,
        };

        request.cookieAuth.set(serverAuth);

        request.logger.info(
          {
            sub: serverAuth.claims.sub,
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
