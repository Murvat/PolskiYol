const signInPath = '/signin-with-chatgpt';
const signOutPath = '/signout-with-chatgpt';

export function getChatGPTUser(request) {
  const { headers } = request;
  const userId = headers.get('oai-authenticated-user-id');
  const email = headers.get('oai-authenticated-user-email');
  if (!userId || !email) return null;

  let displayName = email;
  const encodedName = headers.get('oai-authenticated-user-full-name');
  if (encodedName && headers.get('oai-authenticated-user-full-name-encoding') === 'percent-encoded-utf-8') {
    try {
      displayName = decodeURIComponent(encodedName);
    } catch {
      // Display the email when Dispatch supplies an invalid encoded name.
    }
  }
  return { userId, displayName, email };
}

export function accountLinks(invite, livePath) {
  const live = !invite && typeof livePath === 'string' && /^\/lessons\/[a-z0-9_-]{1,100}\/live$/i.test(livePath);
  const returnTo = new URL(live ? livePath : '/account', 'https://app.local');
  if (invite) returnTo.searchParams.set('invite', invite);
  return {
    signIn: signInPath + '?return_to=' + encodeURIComponent(returnTo.pathname + returnTo.search),
    signOut: signOutPath + '?return_to=' + encodeURIComponent('/'),
  };
}
