import {
  createApiRef,
  configApiRef,
  discoveryApiRef,
  fetchApiRef,
  ConfigApi,
  DiscoveryApi,
  FetchApi,
} from '@backstage/core-plugin-api';
import { KeycloakApi, KeycloakApiClient } from './KeycloakApiClient';

export { KeycloakApiClient } from './KeycloakApiClient';
export type { KeycloakApi, KeycloakClient } from './KeycloakApiClient';

export const keycloakApiRef = createApiRef<KeycloakApi>({
  id: 'plugin.keycloak.api',
});

export const keycloakApiFactory = {
  api: keycloakApiRef,
  deps: {
    discoveryApi: discoveryApiRef,
    fetchApi: fetchApiRef,
    configApi: configApiRef,
  },
  factory: ({ discoveryApi, fetchApi, configApi }: {
    discoveryApi: DiscoveryApi;
    fetchApi: FetchApi;
    configApi: ConfigApi;
  }) =>
    new KeycloakApiClient({ discoveryApi, fetchApi, configApi }),
};
