/**
 * Regenera src/lib/supabase/database.types.ts a partir do banco.
 * Uso: npm run db:types   (lê DATABASE_URL de .env.local; não precisa de Docker)
 */
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL ausente em .env.local.");
  process.exit(1);
}

// Chama a CLI pelo próprio Node, sem shell: a URL (com senha) não passa por
// interpretação de shell nem aparece em logs.
const cli = join(process.cwd(), "node_modules", "supabase", "dist", "supabase.js");
const output = execFileSync(
  process.execPath,
  [cli, "gen", "types", "typescript", "--db-url", url, "--schema", "public"],
  { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], shell: false },
);

const header = "// Gerado por `npm run db:types` (supabase gen types). Não editar à mão.\n";
writeFileSync("src/lib/supabase/database.types.ts", header + output);
console.log("Tipos atualizados em src/lib/supabase/database.types.ts");
