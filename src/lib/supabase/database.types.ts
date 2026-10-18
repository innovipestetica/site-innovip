// Tipos do banco no formato do `supabase gen types typescript`.
// Regenerar sempre que uma migração mudar o schema public:
//   npm run db:types
// (Escrito à mão na etapa 1 até o projeto ser vinculado à CLI.)

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: Record<never, never>;
    Views: Record<never, never>;
    Functions: {
      admin_session_status: {
        Args: Record<PropertyKey, never>;
        Returns: string;
      };
      log_admin_auth_event: {
        Args: { p_action: string };
        Returns: undefined;
      };
    };
    Enums: Record<never, never>;
    CompositeTypes: Record<never, never>;
  };
};
