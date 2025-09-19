import {
  coreServices,
  createBackendPlugin,
} from '@backstage/backend-plugin-api';
import { createRouter } from './service/router';

/**
 * Keycloak backend plugin
 *
 * @public
 */
export const keycloakPlugin = createBackendPlugin({
  pluginId: 'keycloak',
  register(env) {
    env.registerInit({
      deps: {
        httpRouter: coreServices.httpRouter,
        logger: coreServices.logger,
        config: coreServices.rootConfig,
      },
      async init({ httpRouter, logger, config }) {
        httpRouter.use(
          await createRouter({
            logger,
            config,
          }),
        );
        httpRouter.addAuthPolicy({
          path: '/health',
          allow: 'unauthenticated',
        });
      },
    });
  },
});

export default keycloakPlugin;
export { KeycloakService } from './service/KeycloakService';
export type { KeycloakClient, KeycloakConfig } from './service/KeycloakService';
