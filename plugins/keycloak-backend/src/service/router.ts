import { errorHandler } from '@backstage/backend-common';
import { Config } from '@backstage/config';
import { LoggerService } from '@backstage/backend-plugin-api';
import express from 'express';
import Router from 'express-promise-router';
import { KeycloakService } from './KeycloakService';

export interface RouterOptions {
  logger: LoggerService;
  config: Config;
}

export async function createRouter(
  options: RouterOptions,
): Promise<express.Router> {
  const { logger, config } = options;

  const keycloakService = new KeycloakService(config, logger);
  const router = Router();
  router.use(express.json());

  // Health check endpoint
  router.get('/health', (_, response) => {
    logger.info('Health check');
    response.json({ status: 'ok' });
  });

  // Create a new client
  router.post('/clients', async (request, response) => {
    const { realm = 'master', ...clientData } = request.body;
    
    try {
      await keycloakService.createClient(realm, clientData);
      response.status(201).json({ 
        message: `Client ${clientData.clientId} created successfully in realm ${realm}` 
      });
    } catch (error: any) {
      logger.error('Failed to create client', error as Error);
      response.status(error.message.includes('already exists') ? 409 : 500).json({ 
        error: error.message 
      });
    }
  });

  // Get a specific client
  router.get('/clients/:clientId', async (request, response) => {
    const { clientId } = request.params;
    const realm = request.query.realm as string || 'master';
    
    try {
      const client = await keycloakService.getClient(realm, clientId);
      response.json(client);
    } catch (error: any) {
      logger.error(`Failed to get client ${clientId}`, error as Error);
      response.status(404).json({ 
        error: error.message 
      });
    }
  });

  // List all clients in a realm
  router.get('/clients', async (request, response) => {
    const realm = request.query.realm as string || 'master';
    
    try {
      const clients = await keycloakService.listClients(realm);
      response.json(clients);
    } catch (error: any) {
      logger.error('Failed to list clients', error as Error);
      response.status(500).json({ 
        error: error.message 
      });
    }
  });

  // Update a client
  router.put('/clients/:id', async (request, response) => {
    const { id } = request.params;
    const { realm = 'master', ...clientData } = request.body;
    
    try {
      await keycloakService.updateClient(realm, id, clientData);
      response.json({ 
        message: `Client ${id} updated successfully in realm ${realm}` 
      });
    } catch (error: any) {
      logger.error(`Failed to update client ${id}`, error as Error);
      response.status(500).json({ 
        error: error.message 
      });
    }
  });

  // Delete a client
  router.delete('/clients/:id', async (request, response) => {
    const { id } = request.params;
    const realm = request.query.realm as string || 'master';
    
    try {
      await keycloakService.deleteClient(realm, id);
      response.status(204).send();
    } catch (error: any) {
      logger.error(`Failed to delete client ${id}`, error as Error);
      response.status(500).json({ 
        error: error.message 
      });
    }
  });

  // Get client secret
  router.get('/clients/:id/secret', async (request, response) => {
    const { id } = request.params;
    const realm = request.query.realm as string || 'master';
    
    try {
      const secret = await keycloakService.getClientSecret(realm, id);
      response.json({ secret });
    } catch (error: any) {
      logger.error(`Failed to get client secret for ${id}`, error as Error);
      response.status(500).json({ 
        error: error.message 
      });
    }
  });

  // Regenerate client secret
  router.post('/clients/:id/secret', async (request, response) => {
    const { id } = request.params;
    const realm = request.query.realm as string || 'master';
    
    try {
      const secret = await keycloakService.regenerateClientSecret(realm, id);
      response.json({ secret });
    } catch (error: any) {
      logger.error(`Failed to regenerate client secret for ${id}`, error as Error);
      response.status(500).json({ 
        error: error.message 
      });
    }
  });

  router.use(errorHandler());
  return router;
}