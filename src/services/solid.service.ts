import fetch, { Blob } from 'node-fetch';
import {
  generateDpopKeyPair,
  createDpopHeader,
  buildAuthenticatedFetch,
} from '@inrupt/solid-client-authn-core';
import * as solidClient from '@inrupt/solid-client';
import { randomUUID } from 'crypto';
import logger from '../logger.js';

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
export interface AccessModes {
  read?: boolean;
  write?: boolean;
  append?: boolean;
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
  private sessions: Map<string, AuthenticatedFetch> = new Map();

  public getAuthFetch(sessionId: string): AuthenticatedFetch {
    if (!sessionId) {
      throw new SolidToolError("A 'sessionId' is required for this operation.", 400);
    }
    const authFetch = this.sessions.get(sessionId);
    if (!authFetch) {
      throw new SolidToolError("Invalid or expired session. Please login again.", 401);
    }
    return authFetch;
  }

  async authenticate(email: string, password: string, oidcIssuer: string): Promise<string> {
    logger.info('🔷 Authenticating...');
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
    const authFetch = await buildAuthenticatedFetch(accessToken, { dpopKey });
    const sessionId = randomUUID();
    this.sessions.set(sessionId, authFetch);
    logger.info({ sessionId }, `✅ Authentication complete. New session created.`);
    return sessionId;
  }

  async readResource(sessionId: string, resourceUrl: string): Promise<string> {
    const authFetch = this.getAuthFetch(sessionId);
    const file = await solidClient.getFile(resourceUrl, { fetch: authFetch });
    return file.text();
  }

  async writeResource(sessionId: string, resourceUrl: string, content: string, contentType: string = 'text/plain'): Promise<string> {
    const authFetch = this.getAuthFetch(sessionId);
    await solidClient.overwriteFile(
      resourceUrl,
      new Blob([content], { type: contentType }),
      { fetch: authFetch }
    );
    return `✅ Successfully wrote to ${resourceUrl}`;
  }

  async listContainer(sessionId: string, containerUrl: string): Promise<string> {
    const authFetch = this.getAuthFetch(sessionId);
    const containerDataset = await solidClient.getSolidDataset(containerUrl, { fetch: authFetch });
    const containedResources = solidClient.getContainedResourceUrlAll(containerDataset);
    return `Resources in ${containerUrl}:\n${containedResources.join('\n')}`;
  }

  async deleteResource(sessionId: string, resourceUrl: string): Promise<string> {
    const authFetch = this.getAuthFetch(sessionId);
    await solidClient.deleteFile(resourceUrl, { fetch: authFetch });
    return `✅ Successfully deleted ${resourceUrl}`;
  }

  async updateRdfResource(sessionId: string, resourceUrl: string, thingUrl: string, predicate: string, value: string): Promise<string> {
    const authFetch = this.getAuthFetch(sessionId);
    let dataset = await solidClient.getSolidDataset(resourceUrl, { fetch: authFetch });
    let thing = solidClient.getThing(dataset, thingUrl) ?? solidClient.createThing({ url: thingUrl });
    thing = solidClient.setStringNoLocale(thing, predicate, value);
    dataset = solidClient.setThing(dataset, thing);
    await solidClient.saveSolidDatasetAt(resourceUrl, dataset, { fetch: authFetch });
    return `✅ Successfully updated property '${predicate}' in ${resourceUrl}`;
  }

  async grantAccess(sessionId: string, resourceUrl: string, agentWebId: string, access: AccessModes): Promise<string> {
    const authFetch = this.getAuthFetch(sessionId);
    await solidClient.universalAccess.setAgentAccess(
      resourceUrl,
      agentWebId,
      access,
      { fetch: authFetch }
    );
    return `✅ Access permissions updated for ${agentWebId} on ${resourceUrl}.`;
  }
}
