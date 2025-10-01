import { createBackendModule } from '@backstage/backend-plugin-api';
import { authProvidersExtensionPoint, createOAuthProviderFactory } from '@backstage/plugin-auth-node';
import { githubAuthenticator } from '@backstage/plugin-auth-backend-module-github-provider';
import { stringifyEntityRef, DEFAULT_NAMESPACE } from '@backstage/catalog-model';

/**
 * Custom GitHub authentication module that allows any GitHub user to sign in
 * without requiring them to exist in the catalog beforehand.
 *
 * This module creates a custom sign-in resolver that:
 * - Accepts any GitHub user with a valid OAuth token
 * - Creates a user identity based on their GitHub display name (slugified),
 *   falling back to username/login if needed
 * - Issues tokens without requiring catalog entities
 */
export const githubAuthModule = createBackendModule({
  pluginId: 'auth',
  moduleId: 'github-auto-provision',
  register(reg) {
    reg.registerInit({
      deps: {
        providers: authProvidersExtensionPoint,
      },
      async init({ providers }) {
        providers.registerProvider({
          providerId: 'github',
          factory: createOAuthProviderFactory({
            authenticator: githubAuthenticator,
            signInResolver: async (info, ctx) => {
              const { profile } = info;

              // Prefer GitHub display name for identity; fallback to username/login
              const profileAny = profile as any;
              const base =
                profile.displayName?.toString() ||
                profileAny.username?.toString() ||
                profileAny.login?.toString();

              if (!base) {
                throw new Error(
                  'GitHub profile must include a displayName, username, or login',
                );
              }

              // Slugify to a valid Backstage entity name
              const slug = base
                .toLowerCase()
                .trim()
                .replace(/[^a-z0-9._-]+/g, '-') // replace invalid chars with '-'
                .replace(/^-+|-+$/g, '') // trim leading/trailing '-'
                .slice(0, 63) || 'user';

              const userEntityRef = stringifyEntityRef({
                kind: 'User',
                name: slug,
                namespace: DEFAULT_NAMESPACE,
              });

              const ctxAny = ctx as any;
              if (ctxAny.logger) {
                ctxAny.logger.info('GitHub user sign-in success', {
                  userEntityRef,
                  email: profile.email || 'no email',
                  displayName: profile.displayName || base,
                });
              }

              // Allow sign-in without requiring a catalog User entity
              return ctx.issueToken({
                claims: {
                  sub: userEntityRef,
                  ent: [],
                },
              });
            },
          }),
        });
      },
    });
  },
});

export default githubAuthModule;
