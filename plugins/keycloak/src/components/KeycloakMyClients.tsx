import React, { useEffect, useState } from 'react';
import { useApi, identityApiRef } from '@backstage/core-plugin-api';
import { keycloakApiRef, KeycloakClient } from '../api';
import { Content, ContentHeader, Progress, WarningPanel } from '@backstage/core-components';
import { Table, TableBody, TableCell, TableHead, TableRow, Paper, Typography, Button, Collapse, Box } from '@material-ui/core';

export const KeycloakMyClients = () => {
  const keycloakApi = useApi(keycloakApiRef);
  const identityApi = useApi(identityApiRef);
  const [realm] = useState('master');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [clients, setClients] = useState<KeycloakClient[]>([]);
  // These must be declared unconditionally at the top level to keep hook order stable
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [history, setHistory] = useState<Record<string, any[]>>({});
  const [revealed, setRevealed] = useState<Record<string, string>>({});

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        await identityApi.getBackstageIdentity(); // ensure logged in
        const data = await keycloakApi.listMyClients(realm);
        if (mounted) {
          setClients(data);
        }
      } catch (e: any) {
        setError(e.message ?? 'Failed to load clients');
      } finally {
        setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [keycloakApi, identityApi, realm]);

  if (loading) return <Progress />;
  if (error) return <WarningPanel title="Could not load your Keycloak clients" message={error} />;

  const toggleExpand = async (id?: string) => {
    if (!id) return;
    const newId = expandedId === id ? null : id;
    setExpandedId(newId);
    if (newId && !history[newId]) {
      try {
        const rows = await keycloakApi.listSecretHistory(realm, newId);
        setHistory(prev => ({ ...prev, [newId]: rows }));
      } catch (e: any) {
        setError(e.message ?? 'Failed to load secret history');
      }
    }
  };

  const revealSecret = async (id?: string) => {
    if (!id) return;
    try {
      const s = await keycloakApi.getClientSecret(realm, id);
      setRevealed(prev => ({ ...prev, [id]: s }));
    } catch (e: any) {
      setError(e.message ?? 'Failed to fetch client secret');
    }
  };

  return (
    <Paper style={{ padding: 16 }}>
      <ContentHeader title="My Keycloak Clients" />
      {clients.length === 0 ? (
        <Typography variant="body1">You have not created any clients yet.</Typography>
      ) : (
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Client ID</TableCell>
              <TableCell>Name</TableCell>
              <TableCell>Description</TableCell>
              <TableCell>ID</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {clients.map((c, i) => (
              <React.Fragment key={c.id ?? c.clientId ?? i}>
                <TableRow>
                  <TableCell>{c.clientId}</TableCell>
                  <TableCell>{c.name}</TableCell>
                  <TableCell>{c.description}</TableCell>
                  <TableCell>{c.id}</TableCell>
                  <TableCell>
                    <Button size="small" color="primary" onClick={() => toggleExpand(c.id)}>
                      {expandedId === c.id ? 'Hide' : 'View Secrets'}
                    </Button>
                    <Button
                      size="small"
                      color="secondary"
                      style={{ marginLeft: 8 }}
                      onClick={async () => {
                        if (!c.id) return;
                        const ok = window.confirm(`Delete client ${c.clientId}? This cannot be undone.`);
                        if (!ok) return;
                        try {
                          await keycloakApi.deleteClient(realm, c.id);
                          // remove from table
                          setClients(prev => prev.filter(x => x.id !== c.id));
                        } catch (e: any) {
                          setError(e.message ?? 'Failed to delete client');
                        }
                      }}
                      disabled={!c.id}
                    >
                      Delete Client
                    </Button>
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell colSpan={5} style={{ paddingBottom: 0, paddingTop: 0 }}>
                    <Collapse in={expandedId === c.id} timeout="auto" unmountOnExit>
                      <Box margin={1}>
                        <Typography variant="subtitle2">Current Secret</Typography>
                        <Button size="small" variant="outlined" onClick={() => revealSecret(c.id)}>
                          Reveal Secret
                        </Button>
                        <Button
                          size="small"
                          variant="outlined"
                          style={{ marginLeft: 8 }}
                          onClick={async () => {
                            if (!c.id) return;
                            try {
                              const newSecret = await keycloakApi.regenerateClientSecret(realm, c.id);
                              setRevealed(prev => ({ ...prev, [c.id!]: newSecret }));
                              const rows = await keycloakApi.listSecretHistory(realm, c.id);
                              setHistory(prev => ({ ...prev, [c.id!]: rows }));
                            } catch (e: any) {
                              setError(e.message ?? 'Failed to rotate client secret');
                            }
                          }}
                          disabled={!c.id}
                        >
                          Rotate Secret
                        </Button>
                        <Button
                          size="small"
                          variant="outlined"
                          color="secondary"
                          style={{ marginLeft: 8 }}
                          onClick={async () => {
                            if (!c.id) return;
                            const ok = window.confirm('Delete client secret? This may not be supported by your Keycloak version. Continue?');
                            if (!ok) return;
                            try {
                              await keycloakApi.deleteClientSecret(realm, c.id);
                              // Clear revealed secret
                              setRevealed(prev => {
                                const next = { ...prev };
                                delete next[c.id!];
                                return next;
                              });
                              // Refresh history for this client
                              const rows = await keycloakApi.listSecretHistory(realm, c.id);
                              setHistory(prev => ({ ...prev, [c.id!]: rows }));
                            } catch (e: any) {
                              setError(e.message ?? 'Failed to delete client secret');
                            }
                          }}
                          disabled={!c.id}
                        >
                          Delete Secret
                        </Button>
                        {revealed[c.id || ''] && (
                          <Typography variant="body2" style={{ fontFamily: 'monospace', marginLeft: 8 }}>
                            {revealed[c.id || '']}
                          </Typography>
                        )}
                        <Box marginTop={2}>
                          <Typography variant="subtitle2">Secret History (last 4 only)</Typography>
                          <Table size="small">
                            <TableHead>
                              <TableRow>
                                <TableCell>When</TableCell>
                                <TableCell>Action</TableCell>
                                <TableCell>Last 4</TableCell>
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {(history[c.id || ''] || []).map(row => (
                                <TableRow key={row.id}>
                                  <TableCell>{new Date(row.created_at).toLocaleString()}</TableCell>
                                  <TableCell>{row.action}</TableCell>
                                  <TableCell>{row.secret_last4 || ''}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </Box>
                      </Box>
                    </Collapse>
                  </TableCell>
                </TableRow>
              </React.Fragment>
            ))}
          </TableBody>
        </Table>
      )}
    </Paper>
  );
};