// Holds the temporary password typed at login (memory only, never persisted)
// so the first-login "Set your password" popup doesn't ask for it again.
let temporaryPassword: string | null = null;

export function rememberTemporaryPassword(pw: string | null) {
  temporaryPassword = pw;
}

export function getTemporaryPassword(): string | null {
  return temporaryPassword;
}
