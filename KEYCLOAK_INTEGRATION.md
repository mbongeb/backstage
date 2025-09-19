# Keycloak Integration with Backstage

This Backstage instance has been configured to integrate with a local Keycloak server for creating and managing OAuth2/OpenID Connect clients.

## Overview

The integration consists of two plugins:
1. **Backend Plugin (`@internal/plugin-keycloak-backend`)**: Handles API calls to Keycloak Admin REST API
2. **Frontend Plugin (`@internal/plugin-keycloak`)**: Provides UI for managing Keycloak clients

## Configuration

### Keycloak Server Settings

The Keycloak configuration is defined in `app-config.yaml`:

```yaml
keycloak:
  baseUrl: http://localhost:8080  # Your Keycloak server URL
  realm: master                    # Default realm for operations
  clientId: admin-cli              # Client ID for authentication
  username: admin                  # Admin username
  password: admin                  # Admin password
```

Update these values to match your Keycloak server settings.

### Starting Keycloak

To start your local Keycloak server:

```bash
cd ../keycloack-26-3/bin
./kc.sh start-dev
```

The Keycloak admin console will be available at http://localhost:8080

### Starting Backstage

To run Backstage with the Keycloak integration:

```bash
# From the backstage directory
yarn start
```

The Backstage application will be available at http://localhost:3000

## Features

### Creating Keycloak Clients

1. Navigate to the "Keycloak" section in the Backstage sidebar
2. Fill in the client details:
   - **Client ID**: Unique identifier for the client
   - **Realm**: Keycloak realm where the client will be created
   - **Name**: Display name for the client
   - **Description**: Purpose of the client
   - **Redirect URIs**: Valid redirect URIs for OAuth flows
   - **Web Origins**: Allowed CORS origins
   - **Client Settings**: Various OAuth2/OIDC settings

3. Click "Create Client" to create the client in Keycloak

### Client Types

The plugin supports creating different types of clients:
- **Public Clients**: For browser-based applications (no client secret)
- **Confidential Clients**: For server-side applications (with client secret)
- **Bearer Only**: For services that only validate tokens
- **Service Accounts**: For machine-to-machine authentication

## API Endpoints

The backend plugin exposes the following API endpoints:

- `GET /api/keycloak/health` - Health check
- `POST /api/keycloak/clients` - Create a new client
- `GET /api/keycloak/clients` - List all clients
- `GET /api/keycloak/clients/:clientId` - Get client details
- `PUT /api/keycloak/clients/:id` - Update client
- `DELETE /api/keycloak/clients/:id` - Delete client
- `GET /api/keycloak/clients/:id/secret` - Get client secret
- `POST /api/keycloak/clients/:id/secret` - Regenerate client secret

## Security Considerations

1. **Admin Credentials**: The current setup uses admin credentials for Keycloak API access. In production:
   - Use a dedicated service account with minimal required permissions
   - Store credentials securely using environment variables or secret management
   - Consider using client credentials grant instead of password grant

2. **Network Security**: 
   - Use HTTPS for both Keycloak and Backstage in production
   - Implement proper network segmentation
   - Use secure communication between Backstage and Keycloak

3. **Access Control**:
   - Implement proper RBAC in Backstage to control who can create/manage clients
   - Use Keycloak's built-in authorization features

## Troubleshooting

### Common Issues

1. **Connection Refused**: Ensure Keycloak is running on the configured port
2. **401 Unauthorized**: Check admin credentials in app-config.yaml
3. **Client Already Exists**: Use a unique client ID
4. **CORS Issues**: Configure proper CORS settings in Keycloak

### Logs

Check the Backstage backend logs for detailed error messages:
```bash
# Backend logs will show Keycloak API interactions
yarn workspace backend start
```

## Future Enhancements

Potential improvements to the integration:
1. Add client listing and management UI
2. Implement client template support
3. Add realm management capabilities
4. Support for managing users and roles
5. Integration with Backstage catalog for service discovery
6. Automated client provisioning via scaffolder templates

## Support

For issues or questions about the Keycloak integration:
1. Check the logs for error messages
2. Verify Keycloak server is running and accessible
3. Ensure proper configuration in app-config.yaml
4. Review the plugin source code in `/plugins/keycloak` and `/plugins/keycloak-backend`