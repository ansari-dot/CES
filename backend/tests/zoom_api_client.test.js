import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { zoomApiClient } from '../src/shared/services/zoomApiClient.js';
import { config } from '../src/config/index.js';

describe('Zoom API Client & Server-to-Server OAuth Integration', () => {
  it('should detect configuration status accurately based on environment variables', () => {
    const isConfigured = zoomApiClient.isConfigured();
    assert.equal(typeof isConfigured, 'boolean');
    if (!config.ZOOM_ACCOUNT_ID || !config.ZOOM_CLIENT_ID || !config.ZOOM_CLIENT_SECRET) {
      assert.equal(isConfigured, false);
    }
  });

  it('testConnection should return informative status when credentials are not set', async () => {
    if (!zoomApiClient.isConfigured()) {
      const status = await zoomApiClient.testConnection();
      assert.equal(status.configured, false);
      assert.equal(status.connected, false);
      assert.ok(status.message.includes('not set'));
    }
  });

  it('throws descriptive error if getAccessToken is invoked without configuration', async () => {
    if (!zoomApiClient.isConfigured()) {
      await assert.rejects(
        async () => {
          await zoomApiClient.getAccessToken();
        },
        /not configured in \.env/
      );
    }
  });
});
