export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_LENGTH = 72; // limite do bcrypt usado pelo Supabase Auth

/** Retorna a mensagem de problema da senha, ou null se aceitável. */
export function passwordProblem(password: string): string | null {
  if (password.length < PASSWORD_MIN_LENGTH) {
    return `Use pelo menos ${PASSWORD_MIN_LENGTH} caracteres.`;
  }
  if (new TextEncoder().encode(password).length > PASSWORD_MAX_LENGTH) {
    return `Use no máximo ${PASSWORD_MAX_LENGTH} caracteres.`;
  }
  if (/^(.)\1+$/.test(password)) {
    return "Evite repetir o mesmo caractere.";
  }
  return null;
}
