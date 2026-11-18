type CodeResponse = { code?: string; error?: string; error_description?: string };
type ErrorResponse = { type: 'popup_closed' | 'popup_failed_to_open' | 'unknown'; message?: string };

type CodeClient = { requestCode: () => void };

type GoogleAccounts = {
  oauth2: {
    initCodeClient: (config: {
      client_id: string;
      scope: string;
      ux_mode: 'popup';
      callback: (response: CodeResponse) => void;
      error_callback?: (error: ErrorResponse) => void;
    }) => CodeClient;
  };
};

declare global {
  interface Window {
    google?: { accounts: GoogleAccounts };
  }
}

const SCRIPT_SRC = 'https://accounts.google.com/gsi/client';

let scriptPromise: Promise<void> | null = null;

const loadScript = () => {
  scriptPromise ??= new Promise<void>((resolve, reject) => {
    if (window.google?.accounts) return resolve();
    const script = document.createElement('script');
    script.src = SCRIPT_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      scriptPromise = null;
      reject(new Error('Could not load Google sign-in. Check your connection or ad blocker.'));
    };
    document.head.appendChild(script);
  });
  return scriptPromise;
};

export const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim() || '';

export class GoogleCancelled extends Error {}

export const requestGoogleCode = async (): Promise<string> => {
  if (!googleClientId) throw new Error('Google sign-in is not configured. Set VITE_GOOGLE_CLIENT_ID.');
  await loadScript();
  const accounts = window.google?.accounts;
  if (!accounts) throw new Error('Google sign-in did not load.');

  return new Promise<string>((resolve, reject) => {
    const client = accounts.oauth2.initCodeClient({
      client_id: googleClientId,
      scope: 'openid email profile',
      ux_mode: 'popup',
      callback: (response) => {
        if (response.code) resolve(response.code);
        else if (response.error === 'access_denied') reject(new GoogleCancelled('Sign-in was cancelled. Try again.'));
        else reject(new Error(response.error_description || 'Google sign-in failed.'));
      },
      error_callback: (error) => {
        if (error.type === 'popup_closed') reject(new GoogleCancelled('Sign-in was cancelled. Try again.'));
        else if (error.type === 'popup_failed_to_open') reject(new Error('The sign-in popup was blocked. Allow popups for this site.'));
        else reject(new Error(error.message || 'Google sign-in failed.'));
      },
    });
    client.requestCode();
  });
};
