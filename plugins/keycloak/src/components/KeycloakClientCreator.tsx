import React, { useState } from 'react';
import {
  Button,
  TextField,
  FormControlLabel,
  Checkbox,
  Grid,
  Typography,
  Paper,
  Chip,
  IconButton,
} from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import AddIcon from '@material-ui/icons/Add';
import { Alert } from '@material-ui/lab';
import { Progress } from '@backstage/core-components';
import { useApi } from '@backstage/core-plugin-api';
import { keycloakApiRef } from '../api';
import { KeycloakClient } from '../api/KeycloakApiClient';

const useStyles = makeStyles((theme) => ({
  paper: {
    padding: theme.spacing(3),
    marginBottom: theme.spacing(2),
  },
  form: {
    width: '100%',
  },
  submit: {
    marginTop: theme.spacing(3),
  },
  urlChip: {
    marginRight: theme.spacing(1),
    marginBottom: theme.spacing(1),
  },
  urlInput: {
    marginTop: theme.spacing(2),
  },
}));

export const KeycloakClientCreator = () => {
  const classes = useStyles();
  const keycloakApi = useApi(keycloakApiRef);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);

  const [formData, setFormData] = useState<KeycloakClient>({
    clientId: '',
    name: '',
    description: '',
    realm: 'master',
    enabled: true,
    protocol: 'openid-connect',
    publicClient: false,
    redirectUris: [],
    webOrigins: [],
    bearerOnly: false,
    serviceAccountsEnabled: false,
    authorizationServicesEnabled: false,
    directAccessGrantsEnabled: true,
    implicitFlowEnabled: false,
    standardFlowEnabled: true,
  });

  const [redirectUriInput, setRedirectUriInput] = useState('');
  const [webOriginInput, setWebOriginInput] = useState('');

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, checked, type } = event.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const addRedirectUri = () => {
    if (redirectUriInput) {
      setFormData((prev) => ({
        ...prev,
        redirectUris: [...(prev.redirectUris || []), redirectUriInput],
      }));
      setRedirectUriInput('');
    }
  };

  const removeRedirectUri = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      redirectUris: prev.redirectUris?.filter((_, i) => i !== index) || [],
    }));
  };

  const addWebOrigin = () => {
    if (webOriginInput) {
      setFormData((prev) => ({
        ...prev,
        webOrigins: [...(prev.webOrigins || []), webOriginInput],
      }));
      setWebOriginInput('');
    }
  };

  const removeWebOrigin = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      webOrigins: prev.webOrigins?.filter((_, i) => i !== index) || [],
    }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);
    setClientSecret(null);

    try {
      await keycloakApi.createClient(formData);
      setSuccess(`Client "${formData.clientId}" created successfully!`);

      // If it's a confidential client, try to get the secret
      if (!formData.publicClient) {
        try {
          const client = await keycloakApi.getClient(
            formData.realm || 'master',
            formData.clientId,
          );
          if (client.id) {
            const secret = await keycloakApi.getClientSecret(
              formData.realm || 'master',
              client.id,
            );
            setClientSecret(secret);
          }
        } catch (secretError) {
          console.warn('Could not retrieve client secret:', secretError);
        }
      }

      // Reset form
      setFormData({
        clientId: '',
        name: '',
        description: '',
        realm: 'master',
        enabled: true,
        protocol: 'openid-connect',
        publicClient: false,
        redirectUris: [],
        webOrigins: [],
        bearerOnly: false,
        serviceAccountsEnabled: false,
        authorizationServicesEnabled: false,
        directAccessGrantsEnabled: true,
        implicitFlowEnabled: false,
        standardFlowEnabled: true,
      });
    } catch (err: any) {
      setError(err.message || 'Failed to create client');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <Progress />;
  }

  return (
    <Paper className={classes.paper}>
      <Typography variant="h5" gutterBottom>
        Create Keycloak Client
      </Typography>

      {error && (
        <Alert severity="error" onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {success && (
        <>
          <Alert severity="success" onClose={() => setSuccess(null)}>
            {success}
          </Alert>
          {clientSecret && (
            <Alert severity="info" style={{ marginTop: 8 }}>
              <Typography variant="subtitle2">Client Secret:</Typography>
              <Typography variant="body2" style={{ fontFamily: 'monospace' }}>
                {clientSecret}
              </Typography>
              <Typography variant="caption" display="block" style={{ marginTop: 8 }}>
                Please save this secret. You won't be able to see it again!
              </Typography>
            </Alert>
          )}
        </>
      )}

      <form onSubmit={handleSubmit} className={classes.form}>
        <Grid container spacing={3}>
          <Grid item xs={12} sm={6}>
            <TextField
              required
              fullWidth
              label="Client ID"
              name="clientId"
              value={formData.clientId}
              onChange={handleChange}
              helperText="Unique identifier for the client"
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Realm"
              name="realm"
              value={formData.realm}
              onChange={handleChange}
              helperText="Keycloak realm where the client will be created"
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              helperText="Display name for the client"
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              fullWidth
              multiline
              rows={2}
              label="Description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              helperText="Description of the client's purpose"
            />
          </Grid>

          <Grid item xs={12}>
            <Typography variant="subtitle2" gutterBottom>
              Redirect URIs
            </Typography>
            <div>
              {formData.redirectUris?.map((uri, index) => (
                <Chip
                  key={index}
                  label={uri}
                  onDelete={() => removeRedirectUri(index)}
                  className={classes.urlChip}
                />
              ))}
            </div>
            <Grid container spacing={1} alignItems="center" className={classes.urlInput}>
              <Grid item xs={10}>
                <TextField
                  fullWidth
                  placeholder="https://example.com/callback"
                  value={redirectUriInput}
                  onChange={(e) => setRedirectUriInput(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addRedirectUri();
                    }
                  }}
                />
              </Grid>
              <Grid item xs={2}>
                <IconButton onClick={addRedirectUri} color="primary">
                  <AddIcon />
                </IconButton>
              </Grid>
            </Grid>
          </Grid>

          <Grid item xs={12}>
            <Typography variant="subtitle2" gutterBottom>
              Web Origins
            </Typography>
            <div>
              {formData.webOrigins?.map((origin, index) => (
                <Chip
                  key={index}
                  label={origin}
                  onDelete={() => removeWebOrigin(index)}
                  className={classes.urlChip}
                />
              ))}
            </div>
            <Grid container spacing={1} alignItems="center" className={classes.urlInput}>
              <Grid item xs={10}>
                <TextField
                  fullWidth
                  placeholder="https://example.com"
                  value={webOriginInput}
                  onChange={(e) => setWebOriginInput(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addWebOrigin();
                    }
                  }}
                />
              </Grid>
              <Grid item xs={2}>
                <IconButton onClick={addWebOrigin} color="primary">
                  <AddIcon />
                </IconButton>
              </Grid>
            </Grid>
          </Grid>

          <Grid item xs={12}>
            <Typography variant="subtitle2" gutterBottom>
              Client Settings
            </Typography>
          </Grid>

          <Grid item xs={12} sm={6} md={4}>
            <FormControlLabel
              control={
                <Checkbox
                  checked={formData.enabled}
                  onChange={handleChange}
                  name="enabled"
                />
              }
              label="Enabled"
            />
          </Grid>
          <Grid item xs={12} sm={6} md={4}>
            <FormControlLabel
              control={
                <Checkbox
                  checked={formData.publicClient}
                  onChange={handleChange}
                  name="publicClient"
                />
              }
              label="Public Client"
            />
          </Grid>
          <Grid item xs={12} sm={6} md={4}>
            <FormControlLabel
              control={
                <Checkbox
                  checked={formData.bearerOnly}
                  onChange={handleChange}
                  name="bearerOnly"
                />
              }
              label="Bearer Only"
            />
          </Grid>
          <Grid item xs={12} sm={6} md={4}>
            <FormControlLabel
              control={
                <Checkbox
                  checked={formData.serviceAccountsEnabled}
                  onChange={handleChange}
                  name="serviceAccountsEnabled"
                />
              }
              label="Service Accounts Enabled"
            />
          </Grid>
          <Grid item xs={12} sm={6} md={4}>
            <FormControlLabel
              control={
                <Checkbox
                  checked={formData.authorizationServicesEnabled}
                  onChange={handleChange}
                  name="authorizationServicesEnabled"
                />
              }
              label="Authorization Enabled"
            />
          </Grid>
          <Grid item xs={12} sm={6} md={4}>
            <FormControlLabel
              control={
                <Checkbox
                  checked={formData.directAccessGrantsEnabled}
                  onChange={handleChange}
                  name="directAccessGrantsEnabled"
                />
              }
              label="Direct Access Grants"
            />
          </Grid>
          <Grid item xs={12} sm={6} md={4}>
            <FormControlLabel
              control={
                <Checkbox
                  checked={formData.implicitFlowEnabled}
                  onChange={handleChange}
                  name="implicitFlowEnabled"
                />
              }
              label="Implicit Flow"
            />
          </Grid>
          <Grid item xs={12} sm={6} md={4}>
            <FormControlLabel
              control={
                <Checkbox
                  checked={formData.standardFlowEnabled}
                  onChange={handleChange}
                  name="standardFlowEnabled"
                />
              }
              label="Standard Flow"
            />
          </Grid>
        </Grid>

        <Button
          type="submit"
          variant="contained"
          color="primary"
          className={classes.submit}
          disabled={!formData.clientId}
        >
          Create Client
        </Button>
      </form>
    </Paper>
  );
};