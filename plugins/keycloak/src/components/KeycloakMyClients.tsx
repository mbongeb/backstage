import React, { useEffect, useState } from 'react';
import { useApi, identityApiRef } from '@backstage/core-plugin-api';
import { keycloakApiRef, KeycloakClient } from '../api';
import { Content, ContentHeader, Progress, WarningPanel } from '@backstage/core-components';
import { Table, TableBody, TableCell, TableHead, TableRow, Paper, Typography, Button, Collapse, Box, TextField, Chip, Tooltip } from '@material-ui/core';
import InfoOutlinedIcon from '@material-ui/icons/InfoOutlined';

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
  const [claimInput, setClaimInput] = useState('');
  const [claimCandidates, setClaimCandidates] = useState<Array<{id: string; clientId: string; name?: string}>>([]);

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
      <Box display="flex" alignItems="center" marginBottom={2}>
        <TextField
          size="small"
          label="Client ID or Name"
          value={claimInput}
          onChange={e => setClaimInput(e.target.value)}
          variant="outlined"
          style={{ marginRight: 8 }}
        />
        <Button
          size="small"
          variant="outlined"
          onClick={async () => {
            if (!claimInput.trim()) return;
            setClaimCandidates([]);
            try {
              await keycloakApi.takeOwnership(realm, { clientId: claimInput.trim() });
              const refreshed = await keycloakApi.listMyClients(realm);
              setClients(refreshed);
              setClaimInput('');
            } catch (e1: any) {
              try {
                await keycloakApi.takeOwnership(realm, { name: claimInput.trim() });
                const refreshed = await keycloakApi.listMyClients(realm);
                setClients(refreshed);
                setClaimInput('');
              } catch (e2: any) {
                if (e2?.code === 'AMBIGUOUS_NAME' && Array.isArray(e2.candidates)) {
                  setClaimCandidates(e2.candidates);
                  setError(null);
                } else {
                  setError(e2.message ?? e1.message ?? 'Failed to take ownership');
                }
              }
            }
          }}
        >
          Take Ownership
        </Button>
      </Box>
      {claimCandidates.length > 0 && (
        <Box marginBottom={2}>
          <Typography variant="subtitle2">Multiple matches found. Select the client to claim:</Typography>
          {claimCandidates.map(cand => (
            <Box key={cand.id} display="flex" alignItems="center" marginTop={1}>
              <Typography variant="body2" style={{ marginRight: 8 }}>
                {cand.clientId} {cand.name ? `— ${cand.name}` : ''}
              </Typography>
              <Button
                size="small"
                variant="outlined"
                onClick={async () => {
                  try {
                    await keycloakApi.takeOwnership(realm, { clientId: cand.clientId });
                    const refreshed = await keycloakApi.listMyClients(realm);
                    setClients(refreshed);
                    setClaimCandidates([]);
                    setClaimInput('');
                  } catch (e: any) {
                    setError(e.message ?? 'Failed to take ownership');
                  }
                }}
              >
                Claim this
              </Button>
            </Box>
          ))}
        </Box>
      )}
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
                  <TableCell>
                    {c.attributes?.createdByTag === 'inherited' ? (
                      <>
                        <span>{c.name}</span>
                        <Tooltip
                          arrow
                          placement="top"
                          title={
                            <>
                              <div>
                                Inherited by: {c.attributes?.inheritedBy || c.attributes?.createdBy || 'unknown'}
                              </div>
                              <div>
                                Inherited at: {c.attributes?.inheritedAt ? new Date(c.attributes.inheritedAt).toLocaleString() : 'unknown'}
                              </div>
                            </>
                          }
                        >
                          <Chip size="small" label="inherited" style={{ marginLeft: 8 }} />
                        </Tooltip>
                        <Tooltip
                          arrow
                          placement="top"
                          title={
                            <>
                              <div>
                                Inherited by: {c.attributes?.inheritedBy || c.attributes?.createdBy || 'unknown'}
                              </div>
                              <div>
                                Inherited at: {c.attributes?.inheritedAt ? new Date(c.attributes.inheritedAt).toLocaleString() : 'unknown'}
                              </div>
                            </>
                          }
                        >
                          <InfoOutlinedIcon fontSize="small" style={{ marginLeft: 6, verticalAlign: 'middle', color: '#666' }} />
                        </Tooltip>
                      </>
                    ) : (
                      <>
                        <span>{c.name}</span>
                        <Tooltip
                          arrow
                          placement="top"
                          title={
                            <>
                              <div>
                                Created by: {c.attributes?.createdBy || 'unknown'}
                              </div>
                              <div>
                                Created at: {c.attributes?.createdAt ? new Date(c.attributes.createdAt).toLocaleString() : 'unknown'}
                              </div>
                            </>
                          }
                        >
                          <InfoOutlinedIcon fontSize="small" style={{ marginLeft: 6, verticalAlign: 'middle', color: '#666' }} />
                        </Tooltip>
                      </>
                    )}
                  </TableCell>
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
                        const attrs = c.attributes || {};
                        const fmt = (iso?: string) => {
                          try { return iso ? new Date(iso).toLocaleString() : 'unknown'; } catch { return 'unknown'; }
                        };
                        const isInherited = attrs.createdByTag === 'inherited';
                        const details = isInherited
                          ? `inherited by ${attrs.inheritedBy || attrs.createdBy || 'unknown'} on ${fmt(attrs.inheritedAt)}`
                          : `created by ${attrs.createdBy || 'unknown'} on ${fmt(attrs.createdAt)}`;
                        const ok = window.confirm(
                          `You are about to delete client "${c.clientId}" (${details}). This cannot be undone.\n\nProceed?`
                        );
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