// Sentry error monitoring. Initialised once at app boot.
//
// Activates only when VITE_SENTRY_DSN is set in the environment. Local
// dev builds without the DSN run as if Sentry weren't installed — no
// noise, no fake events.
//
// Set the DSN in Netlify env: Site settings -> Environment variables
// -> add VITE_SENTRY_DSN with the URL from your Sentry project. Also
// set VITE_SENTRY_ENVIRONMENT (= "production" / "staging") so events
// are tagged.
//
// Tracing samples a fraction of pageloads to Sentry's perf monitoring.
// 0.1 (10%) is fine to start — increase if you want more granular
// performance data and don't mind the event quota cost.

import * as Sentry from '@sentry/react';

export function initSentry() {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn) return; // Local dev or DSN not yet configured.

  Sentry.init({
    dsn,
    environment: import.meta.env.VITE_SENTRY_ENVIRONMENT || import.meta.env.MODE,
    release: import.meta.env.VITE_SENTRY_RELEASE || undefined,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({
        maskAllText: true,
        blockAllMedia: true,
      }),
    ],
    tracesSampleRate: 0.1,
    replaysSessionSampleRate: 0,    // Don't record routine sessions.
    replaysOnErrorSampleRate: 1.0,  // Always record the session leading
                                    // up to a captured error.
    // Drop noisy events that aren't actionable: chunk-load failures
    // from a stale tab after a fresh deploy, ResizeObserver loop
    // warnings, network noise during navigation.
    ignoreErrors: [
      'ResizeObserver loop limit exceeded',
      'ResizeObserver loop completed with undelivered notifications.',
      /Loading chunk \d+ failed/i,
      /Failed to fetch dynamically imported module/i,
    ],
  });
}

// Convenience wrapper used to attach the current user identity once
// the auth context resolves. Call from AuthContext after onAuthStateChanged.
export function setSentryUser(user) {
  if (!import.meta.env.VITE_SENTRY_DSN) return;
  if (!user) {
    Sentry.setUser(null);
    return;
  }
  Sentry.setUser({
    id: user.uid,
    email: user.email || undefined,
    username: user.name || undefined,
  });
  if (user.organizationId) {
    Sentry.setTag('organizationId', user.organizationId);
  }
}

export { Sentry };
