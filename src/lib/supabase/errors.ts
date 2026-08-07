export class SupabaseNotConfiguredError extends Error {
  constructor(
    message = "Configuration Supabase absente : renseigne NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY.",
  ) {
    super(message);
    this.name = "SupabaseNotConfiguredError";
  }
}
