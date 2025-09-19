import {
  createPlugin,
  createRoutableExtension,
} from '@backstage/core-plugin-api';

import { rootRouteRef } from './routes';
import { keycloakApiFactory } from './api';

export const keycloakPlugin = createPlugin({
  id: 'keycloak',
  apis: [keycloakApiFactory],
  routes: {
    root: rootRouteRef,
  },
});

export const KeycloakPage = keycloakPlugin.provide(
  createRoutableExtension({
    name: 'KeycloakPage',
    component: () =>
      import('./components/KeycloakPage').then(m => m.KeycloakPage),
    mountPoint: rootRouteRef,
  }),
);