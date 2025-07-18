import fetch, { Blob } from 'node-fetch';
import {
  generateDpopKeyPair,
  createDpopHeader,
  buildAuthenticatedFetch,
} from '@inrupt/solid-client-authn-core';
import * as solidClient from '@inrupt/solid-client';

// --- TYPE DEFINITIONS ---
type AuthenticatedFetch = any;
interface CssAccountApiResponse {
  controls: { [key: string]: any };
  authorization?: string;
  id?: string;
  secret?: string;
}
interface OidcTokenResponse {
  access_token: string;
}

// --- CUSTOM ERROR CLASS ---
export class SolidToolError extends Error {
  public status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'SolidToolError';
    this.status = status;
  }
}

// --- MAIN SERVICE CLASS ---
export class SolidCssMcpService {
  private authFetch: AuthenticatedFetch | null = null;

  public getAuthFetch(): AuthenticatedFetch {
    if (!this.authFetch) {
      throw new SolidToolError("Not authenticated. Please login first using the 'solid_login' tool.", 401);
    }
    return this.authFetch;
  }

  async authenticate(email: string, password: string, oidcIssuer: string): Promise<AuthenticatedFetch> {
    console.error('🔷 Authenticating...');
    const cssBase = oidcIssuer;
    const indexRes = await fetch(`${cssBase}.account/`);
    const { controls: indexControls } = (await indexRes.json()) as CssAccountApiResponse;
    const loginRes = await fetch(indexControls.password.login, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const { authorization } = (await loginRes.json()) as CssAccountApiResponse;
    const authIndexRes = await fetch(`${cssBase}.account/`, {
      headers: { authorization: `CSS-Account-Token ${authorization!}` },
    });
    const { controls: authControls } = (await authIndexRes.json()) as CssAccountApiResponse;
    const username = email.split('@')[0];
    const webId = `${cssBase}${username}/profile/card#me`;
    const clientCredRes = await fetch(authControls.account.clientCredentials, {
      method: 'POST',
      headers: {
        authorization: `CSS-Account-Token ${authorization!}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ name: 'mcp-demo-token', webId }),
    });
    const { id: clientId, secret: clientSecret } = (await clientCredRes.json()) as CssAccountApiResponse;
    const dpopKey = await generateDpopKeyPair();
    const authString = `${encodeURIComponent(clientId!)}:${encodeURIComponent(clientSecret!)}`;
    const tokenUrl = `${cssBase}.oidc/token`;
    const tokenRes = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        authorization: `Basic ${Buffer.from(authString).toString('base64')}`,
        'content-type': 'application/x-www-form-urlencoded',
        dpop: await createDpopHeader(tokenUrl, 'POST', dpopKey),
      },
      body: 'grant_type=client_credentials&scope=webid',
    });
    const { access_token: accessToken } = (await tokenRes.json()) as OidcTokenResponse;
    this.authFetch = await buildAuthenticatedFetch(accessToken, { dpopKey });
    console.error('✅ Authentication complete. Session is active.');
    return this.authFetch;
  }

  async readResource(resourceUrl: string): Promise<string> {
    const authFetch = this.getAuthFetch();
    const file = await solidClient.getFile(resourceUrl, { fetch: authFetch });
    return file.text();
  }

  async writeResource(resourceUrl: string, content: string, contentType: string = 'text/plain'): Promise<string> {
    const authFetch = this.getAuthFetch();
    await solidClient.overwriteFile(
      resourceUrl,
      new Blob([content], { type: contentType }),
      { fetch: authFetch }
    );
    return `✅ Successfully wrote to ${resourceUrl}`;
  }

  async listContainer(containerUrl: string): Promise<string> {
    const authFetch = this.getAuthFetch();
    const containerDataset = await solidClient.getSolidDataset(containerUrl, { fetch: authFetch });
    const containedResources = solidClient.getContainedResourceUrlAll(containerDataset);
    return `Resources in ${containerUrl}:\n${containedResources.join('\n')}`;
  }

  async deleteResource(resourceUrl: string): Promise<string> {
    const authFetch = this.getAuthFetch();
    await solidClient.deleteFile(resourceUrl, { fetch: authFetch });
    return `✅ Successfully deleted ${resourceUrl}`;
  }
}
