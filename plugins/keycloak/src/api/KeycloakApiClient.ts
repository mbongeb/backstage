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
  attributes?: Record<string, string>;
}

export interface KeycloakApi {
  createClient(client: KeycloakClient): Promise<void>;
  getClient(realm: string, clientId: string): Promise<KeycloakClient>;
  listClients(realm: string): Promise<KeycloakClient[]>;
  listMyClients(realm: string): Promise<KeycloakClient[]>;
  updateClient(realm: string, id: string, client: Partial<KeycloakClient>): Promise<void>;
  deleteClient(realm: string, id: string): Promise<void>;
  getClientSecret(realm: string, id: string): Promise<string>;
  regenerateClientSecret(realm: string, id: string): Promise<string>;
  deleteClientSecret(realm: string, id: string): Promise<void>;
  takeOwnership(realm: string, payload: { clientId?: string; name?: string }): Promise<{ message: string; id: string; clientId: string; name?: string; attributes?: Record<string, string> }>;
  listSecretHistory(realm: string, id: string): Promise<{
    id: number; realm: string; client_id: string; created_by: string; action: string; secret_last4: string | null; created_at: string;
  }[]>;
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

  async listMyClients(realm: string): Promise<KeycloakClient[]> {
    const baseUrl = await this.getBaseUrl();
    const response = await this.fetchApi.fetch(
      `${baseUrl}/my-clients?realm=${realm}`,
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to list my clients');
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

  async deleteClientSecret(realm: string, id: string): Promise<void> {
    const baseUrl = await this.getBaseUrl();
    const response = await this.fetchApi.fetch(
      `${baseUrl}/clients/${id}/secret?realm=${realm}`,
      {
        method: 'DELETE',
      },
    );
    if (!response.ok && response.status !== 204) {
      let message = 'Failed to delete client secret';
      try {
        const error = await response.json();
        message = error.error || message;
      } catch {}
      throw new Error(message);
    }
  }

  async listSecretHistory(realm: string, id: string) {
    const baseUrl = await this.getBaseUrl();
    const response = await this.fetchApi.fetch(
      `${baseUrl}/clients/${id}/secret-history?realm=${realm}`,
    );
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to list secret history');
    }
    return await response.json();
  }

  async takeOwnership(realm: string, payload: { clientId?: string; name?: string }) {
    const baseUrl = await this.getBaseUrl();
    const response = await this.fetchApi.fetch(`${baseUrl}/take-ownership`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ realm, ...payload }),
    });
    if (!response.ok) {
      let body: any = undefined;
      try {
        body = await response.json();
      } catch {}
      const err: any = new Error((body && body.error) || 'Failed to take ownership');
      if (body && typeof body === 'object') {
        Object.assign(err, body);
      }
      throw err;
    }
    return await response.json();
  }
}
