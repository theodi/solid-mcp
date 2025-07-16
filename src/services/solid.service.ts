import fetch from 'node-fetch';
import {
  generateDpopKeyPair,
  createDpopHeader,
  buildAuthenticatedFetch,
} from '@inrupt/solid-client-authn-core';

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
    console.log('🔷 1. Authenticating...');
    const cssBase = oidcIssuer;
    
    console.log('   a. Discovering Account API…');
    const indexRes = await fetch(`${cssBase}.account/`);
    const { controls: indexControls } = (await indexRes.json()) as CssAccountApiResponse;

    console.log('   b. Logging in to Account API…');
    const loginRes = await fetch(indexControls.password.login, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const { authorization } = (await loginRes.json()) as CssAccountApiResponse;
    console.log('   ✅ Account API auth token acquired.');

    const authIndexRes = await fetch(`${cssBase}.account/`, {
      headers: { authorization: `CSS-Account-Token ${authorization!}` },
    });
    const { controls: authControls } = (await authIndexRes.json()) as CssAccountApiResponse;
    
    const username = email.split('@')[0];
    const webId = `${cssBase}${username}/profile/card#me`;

    console.log('   c. Requesting client credentials for WebID:', webId);
    const clientCredRes = await fetch(authControls.account.clientCredentials, {
      method: 'POST',
      headers: {
        authorization: `CSS-Account-Token ${authorization!}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ name: 'mcp-demo-token', webId }),
    });
    const { id: clientId, secret: clientSecret } = (await clientCredRes.json()) as CssAccountApiResponse;
    console.log('   ✅ Client credentials acquired.');

    const dpopKey = await generateDpopKeyPair();
    const authString = `${encodeURIComponent(clientId!)}:${encodeURIComponent(clientSecret!)}`;
    const tokenUrl = `${cssBase}.oidc/token`;

    console.log('   d. Requesting OIDC access token…');
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
    console.log('   ✅ OIDC access token acquired.');

    this.authFetch = await buildAuthenticatedFetch(accessToken, { dpopKey });
    console.log('✅ Authentication complete.');
    return this.authFetch;
  }
}
