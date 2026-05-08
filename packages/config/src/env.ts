import type { AppConfig } from '@balance/types';
import { buildApiBaseUrl, normalizeEnvironment, parsePort } from '@balance/utils';

function firstNonEmpty(...values: Array<string | undefined>): string | undefined {
  return values.find((value) => value?.trim())?.trim();
}

function normalizePath(value: string | undefined, fallback: string): string {
  const source = value?.trim() || fallback;
  const withLeadingSlash = source.startsWith('/') ? source : `/${source}`;

  if (withLeadingSlash === '/') {
    return withLeadingSlash;
  }

  return withLeadingSlash.replace(/\/+$/, '');
}

export function loadAppConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const apiPort = parsePort(env.API_PORT, 3001);
  const webPort = parsePort(env.WEB_PORT, 3000);
  const publicHttpPort = parsePort(env.PUBLIC_HTTP_PORT, webPort);
  const apiBaseUrl = buildApiBaseUrl(env.API_BASE_URL, apiPort);
  const apiProxyTarget = buildApiBaseUrl(env.API_PROXY_TARGET, apiPort);
  const appName = firstNonEmpty(env.PRODUCT_NAME, env.APP_NAME) || 'Balance';
  const appEnv = normalizeEnvironment(firstNonEmpty(env.APP_ENV, env.NODE_ENV));
  const apiBasePath = normalizePath(firstNonEmpty(env.API_BASE_PATH, env.NEXT_PUBLIC_API_BASE_PATH), '/api');
  const apiHealthPath = normalizePath(
    firstNonEmpty(env.API_HEALTH_PATH, env.NEXT_PUBLIC_API_HEALTH_PATH),
    `${apiBasePath}/health`
  );
  const apiVersionPath = normalizePath(
    firstNonEmpty(env.API_VERSION_PATH, env.NEXT_PUBLIC_API_VERSION_PATH),
    `${apiBasePath}/version`
  );

  return {
    appName,
    appEnv,
    projectSlug: firstNonEmpty(env.PROJECT_SLUG) || 'balance',
    deploymentNamespace: firstNonEmpty(env.DEPLOYMENT_NAMESPACE) || 'swe40006-project',
    appVersion: env.APP_VERSION?.trim() || '0.1.0',
    gitCommit: env.GIT_COMMIT?.trim() || 'local',
    buildId: env.BUILD_ID?.trim() || 'local-build',
    webPort,
    publicHttpPort,
    apiPort,
    apiBaseUrl,
    apiProxyTarget,
    desktopApiBaseUrl: buildApiBaseUrl(env.DESKTOP_API_BASE_URL, apiPort),
    apiBasePath,
    apiHealthPath,
    apiVersionPath
  };
}
