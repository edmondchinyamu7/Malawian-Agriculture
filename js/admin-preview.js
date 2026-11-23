/**
 * Server-verified administrator preview access.
 * The HttpOnly admin session cookie is checked by the existing server endpoint.
 * No browser storage flag or farmer subscription record can grant this access.
 */
let adminPreviewCheck;

export async function hasAdminPreviewAccess() {
  if (!adminPreviewCheck) {
    adminPreviewCheck = fetch('/api/admin/session', {
      method: 'GET',
      credentials: 'same-origin',
      cache: 'no-store',
      headers: { Accept: 'application/json' }
    })
      .then(async response => {
        if (!response.ok) return false;
        const session = await response.json();
        return session?.authenticated === true && session?.user?.role === 'admin';
      })
      .catch(() => false);
  }
  return adminPreviewCheck;
}
