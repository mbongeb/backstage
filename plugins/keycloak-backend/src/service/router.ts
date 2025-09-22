import { errorHandler } from '@backstage/backend-common';
import { Config } from '@backstage/config';
import { LoggerService } from '@backstage/backend-plugin-api';
import express from 'express';
import Router from 'express-promise-router';
import { KeycloakService } from './KeycloakService';
import { DefaultIdentityClient } from '@backstage/plugin-auth-node';
import type { DatabaseService } from '@backstage/backend-plugin-api';

export interface RouterOptions {
  logger: LoggerService;
  config: Config;
  discovery: any;
  database: DatabaseService;
}

export async function createRouter(
  options: RouterOptions,
): Promise<express.Router> {
  const { logger, config, discovery, database } = options;

  const keycloakService = new KeycloakService(config, logger);
  const identityClient = DefaultIdentityClient.create({ discovery });
  const router = Router();
  router.use(express.json());

  // Initialize DB table for secret history
  const knex = await database.getClient();
  const hasTable = await knex.schema.hasTable('keycloak_client_secret_history');
  if (!hasTable) {
    await knex.schema.createTable('keycloak_client_secret_history', table => {
      table.increments('id').primary();
      table.string('realm').notNullable();
      table.string('client_id').notNullable();
      table.string('created_by').notNullable();
      table.string('action').notNullable(); // 'created' | 'regenerated'
      table.string('secret_last4').nullable();
      table.timestamp('created_at').defaultTo(knex.fn.now());
    });
  }

  // Health check endpoint
  router.get('/health', (_, response) => {
    logger.info('Health check');
    response.json({ status: 'ok' });
  });

  // Create a new client (stores creator in attributes.createdBy)
  router.post('/clients', async (request, response) => {
    const { realm = 'master', ...clientData } = request.body;
    
    try {
      const identity = await identityClient.getIdentity({ request });
      const creator = identity?.identity.userEntityRef || 'unknown';

      const enriched = {
        ...clientData,
        attributes: {
          ...(clientData.attributes || {}),
          createdBy: creator,
        },
      };

      await keycloakService.createClient(realm, enriched as any);
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

  // List clients created by the current Backstage user (alias path)
  router.get('/clients/mine', async (request, response) => {
    const realm = (request.query.realm as string) || 'master';
    try {
      const identity = await identityClient.getIdentity({ request });
      const creator = identity?.identity.userEntityRef || 'unknown';
      const clients = await keycloakService.listClientsByCreator(realm, creator);
      response.json(clients);
    } catch (error: any) {
      logger.error('Failed to list own clients', error as Error);
      response.status(500).json({ error: error.message });
    }
  });

  // Preferred endpoint to list clients created by the current Backstage user
  router.get('/my-clients', async (request, response) => {
    const realm = (request.query.realm as string) || 'master';
    try {
      const identity = await identityClient.getIdentity({ request });
      const creator = identity?.identity.userEntityRef || 'unknown';
      const clients = await keycloakService.listClientsByCreator(realm, creator);
      response.json(clients);
    } catch (error: any) {
      logger.error('Failed to list own clients', error as Error);
      response.status(500).json({ error: error.message });
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
    const realm = (request.query.realm as string) || 'master';
    
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
    const realm = (request.query.realm as string) || 'master';
    
    try {
      const secret = await keycloakService.regenerateClientSecret(realm, id);
      // Record event (store only last4)
      const identity = await identityClient.getIdentity({ request });
      const createdBy = identity?.identity.userEntityRef || 'unknown';
      const last4 = typeof secret === 'string' && secret.length >= 4 ? secret.slice(-4) : null;
      await knex('keycloak_client_secret_history').insert({
        realm,
        client_id: id,
        created_by: createdBy,
        action: 'regenerated',
        secret_last4: last4,
      });
      response.json({ secret });
    } catch (error: any) {
      logger.error(`Failed to regenerate client secret for ${id}`, error as Error);
      response.status(500).json({ 
        error: error.message 
      });
    }
  });

  // List secret history for a client (only entries by the current user)
  router.get('/clients/:id/secret-history', async (request, response) => {
    const { id } = request.params;
    const realm = (request.query.realm as string) || 'master';
    try {
      const identity = await identityClient.getIdentity({ request });
      const createdBy = identity?.identity.userEntityRef || 'unknown';
      const rows = await knex('keycloak_client_secret_history')
        .select('id', 'realm', 'client_id', 'created_by', 'action', 'secret_last4', 'created_at')
        .where({ realm, client_id: id, created_by: createdBy })
        .orderBy('created_at', 'desc');
      response.json(rows);
    } catch (error: any) {
      logger.error(`Failed to list secret history for ${id}`, error as Error);
      response.status(500).json({ error: error.message });
    }
  });

  router.use(errorHandler());
  return router;
}