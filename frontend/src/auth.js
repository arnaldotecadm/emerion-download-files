import { WebStorageStateStore } from "oidc-client-ts";

const origin = window.location.origin;

export const COGNITO_DOMAIN = "https://eu-north-1ntdqlsmut.auth.eu-north-1.amazoncognito.com";
export const COGNITO_CLIENT_ID = "395rpr7l5274ei0ivbjm6l2ptd";

export const cognitoAuthConfig = {
  authority: "https://cognito-idp.eu-north-1.amazonaws.com/eu-north-1_NtDQLSmuT",
  client_id: COGNITO_CLIENT_ID,
  redirect_uri: `${origin}/`,
  post_logout_redirect_uri: `${origin}/`,
  response_type: "code",
  scope: "email openid phone",
  automaticSilentRenew: true,
  userStore: new WebStorageStateStore({ store: window.localStorage }),
  onSigninCallback: () => {
    window.history.replaceState({}, document.title, window.location.pathname);
  },
};

// Cognito uses a non-standard /logout endpoint (not OIDC end_session).
export const cognitoSignOut = (auth) => {
  try {
    auth?.removeUser?.();
  } catch (e) {
    /* ignore */
  }
  const logoutUri = `${origin}/`;
  window.location.href =
    `${COGNITO_DOMAIN}/logout?client_id=${COGNITO_CLIENT_ID}` +
    `&logout_uri=${encodeURIComponent(logoutUri)}`;
};
