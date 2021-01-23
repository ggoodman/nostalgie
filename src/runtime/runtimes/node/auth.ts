import Boom from '@hapi/boom';
import * as Cookie from '@hapi/cookie';
import type { Plugin } from '@hapi/hapi';
import * as OpenID from 'openid-client';
import type { NostalgieAuthOptions } from '../../../settings';

export const authPlugin: Plugin<NostalgieAuthOptions> = {
  name: 'nostalgie/auth',
  async register(server, options) {
    await server.register(Cookie);

    server.auth.strategy('nostalgie-session', 'cookie', {
      cookie: {
        name: 'nsid',
        encoding: 'iron',
        ttl: 1000 * 60 * 60 * 24 * 7 * 4, // 4 weeks
        password: options.cookieSecret,
        path: '/',
        // TODO: FIXME in a way that is dev-friendly
        isSecure: false,
      },
      keepAlive: true,
      validateFunc: async (request, session) => {
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
      password: options.cookieSecret,
      path: '/',
      // TODO: FIXME in a way that is dev-friendly
      isSecure: false,
      isHttpOnly: true,
      ttl: 1000 * 60 * 60, // Session lifetime
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
        // validate: {
        //   query: {
        //     redirect_uri: Joi.string(),
        //   },
        // },
      },
      handler: async (request, h) => {
        if (request.auth.isAuthenticated) {
          return h.redirect('/');
        }

        const issuer = await fetchIssuer(options.issuer);
        const client = new issuer.Client({
          client_id: options.clientId,
          redirect_uris: [`${server.info.uri}/.nostalgie/callback`],
          response_types: ['code'],
        });
        const nonce = OpenID.generators.nonce();
        const url = client.authorizationUrl({
          scope: 'openid email profile',
          response_mode: 'query',
          nonce,
        });

        h.state('nauth', { nonce });

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
      },
      handler: async (request, h) => {
        // const issuer = await fetchIssuer(auth.issuer);
        // const client = new issuer.Client({
        //   client_id: auth.clientId,
        //   redirect_uris: [`${server.info.uri}/.nostalgie/callback`],
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
        //   post_logout_redirect_uri: '/',
        // });

        request.cookieAuth.clear();

        return h.redirect('/');
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

        const nauth = request.state.nauth as { nonce?: string } | undefined;

        if (!nauth) {
          throw Boom.unauthorized('Invalid nonce');
        }

        const redirectUri = `${server.info.uri}/.nostalgie/callback`;
        const issuer = await fetchIssuer(options.issuer);
        const client = new issuer.Client({
          client_id: options.clientId,
          client_secret: options.clientSecret,
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
            { issuer: options.issuer },
            'received a token set lacking an access_token'
          );
          throw Boom.badImplementation();
        }

        const userInfo = await client.userinfo(tokenSet.access_token);

        request.cookieAuth.set({
          user: userInfo,
          accessToken: tokenSet.access_token,
          idToken: tokenSet.id_token,
          refreshToken: tokenSet.refresh_token,
          expiresAt: tokenSet.expires_at,
          expiresIn: tokenSet.expires_in,
        });

        return h.redirect('/');
      },
    });
  },
};
