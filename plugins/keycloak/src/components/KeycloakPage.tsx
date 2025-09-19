import React from 'react';
import {
  Header,
  Page,
  Content,
  ContentHeader,
  HeaderLabel,
  SupportButton,
} from '@backstage/core-components';
import { KeycloakClientCreator } from './KeycloakClientCreator';
import { Grid } from '@material-ui/core';

export const KeycloakPage = () => {
  return (
    <Page themeId="tool">
      <Header title="Keycloak Client Manager" subtitle="Create and manage Keycloak clients">
        <HeaderLabel label="Owner" value="Platform Team" />
        <HeaderLabel label="Lifecycle" value="Production" />
      </Header>
      <Content>
        <ContentHeader title="Keycloak Integration">
          <SupportButton>
            Manage your Keycloak clients directly from Backstage.
            Create new OAuth2/OpenID Connect clients with ease.
          </SupportButton>
        </ContentHeader>
        <Grid container spacing={3} direction="column">
          <Grid item>
            <KeycloakClientCreator />
          </Grid>
        </Grid>
      </Content>
    </Page>
  );
};