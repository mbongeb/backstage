import {
  ConfigApi,
  DiscoveryApi,
  FetchApi,
} from '@backstage/core-plugin-api';

export interface KeycloakClient {
  id?: string;
  clientId: string;
  name?: string;
  description?: string;
  enabled?: boolean;
  protocol?: string;
  publicClient?: boolean;
  redirectUris?: string[];
  webOrigins?: string[];
  bearerOnly?: boolean;
  serviceAccountsEnabled?: boolean;
  authorizationServicesEnabled?: boolean;
  directAccessGrantsEnabled?: boolean;
  implicitFlowEnabled?: boolean;
  standardFlowEnabled?: boolean;
  realm?: string;
}

export interface KeycloakApi {
  createClient(client: KeycloakClient): Promise<void>;
  getClient(realm: string, clientId: string): Promise<KeycloakClient>;
  listClients(realm: string): Promise<KeycloakClient[]>;
  updateClient(realm: string, id: string, client: Partial<KeycloakClient>): Promise<void>;
  deleteClient(realm: string, id: string): Promise<void>;
  getClientSecret(realm: string, id: string): Promise<string>;
  regenerateClientSecret(realm: string, id: string): Promise<string>;
}

export class KeycloakApiClient implements KeycloakApi {
  private readonly discoveryApi: DiscoveryApi;
  private readonly fetchApi: FetchApi;

  constructor(options: {
    discoveryApi: DiscoveryApi;
    fetchApi: FetchApi;
    configApi: ConfigApi;
  }) {
    this.discoveryApi = options.discoveryApi;
    this.fetchApi = options.fetchApi;
  }

  private async getBaseUrl(): Promise<string> {
    return await this.discoveryApi.getBaseUrl('keycloak');
  }

  async createClient(client: KeycloakClient): Promise<void> {
    const baseUrl = await this.getBaseUrl();
    const response = await this.fetchApi.fetch(`${baseUrl}/clients`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(client),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to create client');
    }
  }

  async getClient(realm: string, clientId: string): Promise<KeycloakClient> {
    const baseUrl = await this.getBaseUrl();
    const response = await this.fetchApi.fetch(
      `${baseUrl}/clients/${clientId}?realm=${realm}`,
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to get client');
    }

    return await response.json();
  }

  async listClients(realm: string): Promise<KeycloakClient[]> {
    const baseUrl = await this.getBaseUrl();
    const response = await this.fetchApi.fetch(
      `${baseUrl}/clients?realm=${realm}`,
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to list clients');
    }

    return await response.json();
  }

  async updateClient(
    realm: string,
    id: string,
    client: Partial<KeycloakClient>,
  ): Promise<void> {
    const baseUrl = await this.getBaseUrl();
    const response = await this.fetchApi.fetch(`${baseUrl}/clients/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ...client, realm }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to update client');
    }
  }

  async deleteClient(realm: string, id: string): Promise<void> {
    const baseUrl = await this.getBaseUrl();
    const response = await this.fetchApi.fetch(
      `${baseUrl}/clients/${id}?realm=${realm}`,
      {
        method: 'DELETE',
      },
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to delete client');
    }
  }

  async getClientSecret(realm: string, id: string): Promise<string> {
    const baseUrl = await this.getBaseUrl();
    const response = await this.fetchApi.fetch(
      `${baseUrl}/clients/${id}/secret?realm=${realm}`,
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to get client secret');
    }

    const data = await response.json();
    return data.secret;
  }

  async regenerateClientSecret(realm: string, id: string): Promise<string> {
    const baseUrl = await this.getBaseUrl();
    const response = await this.fetchApi.fetch(
      `${baseUrl}/clients/${id}/secret?realm=${realm}`,
      {
        method: 'POST',
      },
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to regenerate client secret');
    }

    const data = await response.json();
    return data.secret;
  }
}