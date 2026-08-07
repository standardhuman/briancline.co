import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as viteConfigModule from '../vite.config.js';

function makeConfig(env, sentryPlugin) {
  expect(viteConfigModule.createViteConfig).toBeTypeOf('function');
  return viteConfigModule.createViteConfig(env, sentryPlugin);
}

describe('Vite Sentry source-map upload gating', () => {
  let sentryPlugin;

  beforeEach(() => {
    sentryPlugin = vi.fn((options) => ({ name: 'sentry-test-plugin', options }));
  });

  it('enables the plugin, hidden maps, deletion, and release only with every credential', () => {
    const config = makeConfig({
      SENTRY_AUTH_TOKEN: ' auth-token ',
      SENTRY_ORG: ' brian-org ',
      SENTRY_PROJECT: ' briancline-co ',
      VERCEL_GIT_COMMIT_SHA: ' commit123 ',
    }, sentryPlugin);

    expect(config.build.sourcemap).toBe('hidden');
    expect(sentryPlugin).toHaveBeenCalledOnce();
    expect(sentryPlugin).toHaveBeenCalledWith({
      authToken: 'auth-token',
      org: 'brian-org',
      project: 'briancline-co',
      release: { name: 'commit123' },
      sourcemaps: { filesToDeleteAfterUpload: 'dist/**/*.map' },
    });
    expect(config.plugins.at(-1)).toMatchObject({ name: 'sentry-test-plugin' });
  });

  it.each([
    { SENTRY_ORG: 'org', SENTRY_PROJECT: 'project' },
    { SENTRY_AUTH_TOKEN: 'token', SENTRY_PROJECT: 'project' },
    { SENTRY_AUTH_TOKEN: 'token', SENTRY_ORG: 'org' },
    { SENTRY_AUTH_TOKEN: 'token', SENTRY_ORG: 'org', SENTRY_PROJECT: '   ' },
  ])('disables the plugin and maps when credentials are partial: %o', (env) => {
    const config = makeConfig(env, sentryPlugin);

    expect(config.build.sourcemap).toBe(false);
    expect(sentryPlugin).not.toHaveBeenCalled();
    expect(config.plugins).not.toContainEqual(expect.objectContaining({ name: 'sentry-test-plugin' }));
  });

  it('disables the plugin and maps when no upload credentials exist', () => {
    const config = makeConfig({}, sentryPlugin);

    expect(config.build.sourcemap).toBe(false);
    expect(sentryPlugin).not.toHaveBeenCalled();
    expect(config.plugins).not.toContainEqual(expect.objectContaining({ name: 'sentry-test-plugin' }));
  });
});
