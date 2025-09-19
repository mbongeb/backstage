import { Config } from '@backstage/config';
import { LoggerService } from '@backstage/backend-plugin-api';
import axios, { AxiosInstance } from 'axios';

export interface KeycloakClient {
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
}

export interface KeycloakConfig {
  baseUrl: string;
  realm: string;
  clientId: string;
  clientSecret: string;
  username?: string;
  password?: string;
}

export class KeycloakService {
  private axiosInstance: AxiosInstance;
  private config: KeycloakConfig;
  private accessToken?: string;
  private tokenExpiryTime?: number;
  private logger: LoggerService;

  constructor(config: Config, logger: LoggerService) {
    this.logger = logger;
    
    // Read Keycloak configuration from Backstage config
    this.config = {
      baseUrl: config.getOptionalString('keycloak.baseUrl') || 'http://localhost:8080',
      realm: config.getOptionalString('keycloak.realm') || 'master',
      clientId: config.getOptionalString('keycloak.clientId') || 'admin-cli',
      clientSecret: config.getOptionalString('keycloak.clientSecret') || '',
      username: config.getOptionalString('keycloak.username') || 'admin',
      password: config.getOptionalString('keycloak.password') || 'admin',
    };

    this.axiosInstance = axios.create({
      baseURL: this.config.baseUrl,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  private async getAccessToken(): Promise<string> {
    // Check if we have a valid token
    if (this.accessToken && this.tokenExpiryTime && Date.now() < this.tokenExpiryTime) {
      return this.accessToken;
    }

    try {
      // Get new access token using client credentials or password grant
      const tokenUrl = `${this.config.baseUrl}/realms/${this.config.realm}/protocol/openid-connect/token`;
      
      const data = new URLSearchParams();
      if (this.config.username && this.config.password) {
        // Use password grant for admin access
        data.append('grant_type', 'password');
        data.append('client_id', this.config.clientId);
        data.append('username', this.config.username);
        data.append('password', this.config.password);
        if (this.config.clientSecret) {
          data.append('client_secret', this.config.clientSecret);
        }
      } else {
        // Use client credentials grant
        data.append('grant_type', 'client_credentials');
        data.append('client_id', this.config.clientId);
        data.append('client_secret', this.config.clientSecret);
      }

      const response = await axios.post(tokenUrl, data, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });

      this.accessToken = response.data.access_token;
      // Set token expiry time (subtract 60 seconds for safety)
      this.tokenExpiryTime = Date.now() + (response.data.expires_in - 60) * 1000;

      this.logger.info('Successfully obtained Keycloak access token');
      return this.accessToken!;
    } catch (error) {
      this.logger.error('Failed to get Keycloak access token', error as Error);
      throw new Error(`Failed to authenticate with Keycloak: ${error}`);
    }
  }

  async createClient(realm: string, clientData: KeycloakClient): Promise<void> {
    const token = await this.getAccessToken();
    
    try {
      const url = `${this.config.baseUrl}/admin/realms/${realm}/clients`;
      
      const client = {
        clientId: clientData.clientId,
        name: clientData.name || clientData.clientId,
        description: clientData.description,
        enabled: clientData.enabled !== false,
        protocol: clientData.protocol || 'openid-connect',
        publicClient: clientData.publicClient || false,
        redirectUris: clientData.redirectUris || ['*'],
        webOrigins: clientData.webOrigins || ['*'],
        bearerOnly: clientData.bearerOnly || false,
        serviceAccountsEnabled: clientData.serviceAccountsEnabled || false,
        authorizationServicesEnabled: clientData.authorizationServicesEnabled || false,
        directAccessGrantsEnabled: clientData.directAccessGrantsEnabled || true,
        implicitFlowEnabled: clientData.implicitFlowEnabled || false,
        standardFlowEnabled: clientData.standardFlowEnabled || true,
      };

      await this.axiosInstance.post(url, client, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      this.logger.info(`Successfully created Keycloak client: ${clientData.clientId} in realm: ${realm}`);
    } catch (error: any) {
      if (error.response?.status === 409) {
        throw new Error(`Client ${clientData.clientId} already exists in realm ${realm}`);
      }
      this.logger.error(`Failed to create Keycloak client: ${clientData.clientId}`, error as Error);
      throw new Error(`Failed to create client: ${error.message}`);
    }
  }

  async getClient(realm: string, clientId: string): Promise<any> {
    const token = await this.getAccessToken();
    
    try {
      // First, get all clients and find the one with matching clientId
      const url = `${this.config.baseUrl}/admin/realms/${realm}/clients`;
      const response = await this.axiosInstance.get(url, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        params: {
          clientId: clientId,
        },
      });

      const clients = response.data;
      if (clients && clients.length > 0) {
        return clients[0];
      }
      
      throw new Error(`Client ${clientId} not found in realm ${realm}`);
    } catch (error: any) {
      this.logger.error(`Failed to get Keycloak client: ${clientId}`, error as Error);
      throw new Error(`Failed to get client: ${error.message}`);
    }
  }

  async listClients(realm: string): Promise<any[]> {
    const token = await this.getAccessToken();
    
    try {
      const url = `${this.config.baseUrl}/admin/realms/${realm}/clients`;
      const response = await this.axiosInstance.get(url, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      return response.data;
    } catch (error: any) {
      this.logger.error(`Failed to list Keycloak clients in realm: ${realm}`, error as Error);
      throw new Error(`Failed to list clients: ${error.message}`);
    }
  }

  async updateClient(realm: string, id: string, clientData: Partial<KeycloakClient>): Promise<void> {
    const token = await this.getAccessToken();
    
    try {
      const url = `${this.config.baseUrl}/admin/realms/${realm}/clients/${id}`;
      await this.axiosInstance.put(url, clientData, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      this.logger.info(`Successfully updated Keycloak client: ${id} in realm: ${realm}`);
    } catch (error: any) {
      this.logger.error(`Failed to update Keycloak client: ${id}`, error as Error);
      throw new Error(`Failed to update client: ${error.message}`);
    }
  }

  async deleteClient(realm: string, id: string): Promise<void> {
    const token = await this.getAccessToken();
    
    try {
      const url = `${this.config.baseUrl}/admin/realms/${realm}/clients/${id}`;
      await this.axiosInstance.delete(url, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      this.logger.info(`Successfully deleted Keycloak client: ${id} from realm: ${realm}`);
    } catch (error: any) {
      this.logger.error(`Failed to delete Keycloak client: ${id}`, error as Error);
      throw new Error(`Failed to delete client: ${error.message}`);
    }
  }

  async getClientSecret(realm: string, id: string): Promise<string> {
    const token = await this.getAccessToken();
    
    try {
      const url = `${this.config.baseUrl}/admin/realms/${realm}/clients/${id}/client-secret`;
      const response = await this.axiosInstance.get(url, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      return response.data.value;
    } catch (error: any) {
      this.logger.error(`Failed to get client secret for: ${id}`, error as Error);
      throw new Error(`Failed to get client secret: ${error.message}`);
    }
  }

  async regenerateClientSecret(realm: string, id: string): Promise<string> {
    const token = await this.getAccessToken();
    
    try {
      const url = `${this.config.baseUrl}/admin/realms/${realm}/clients/${id}/client-secret`;
      const response = await this.axiosInstance.post(url, {}, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      return response.data.value;
    } catch (error: any) {
      this.logger.error(`Failed to regenerate client secret for: ${id}`, error as Error);
      throw new Error(`Failed to regenerate client secret: ${error.message}`);
    }
  }
}