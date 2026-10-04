#!/usr/bin/env node
// Asistente para configurar una tienda nueva desde la plantilla: genera el .env.
// Uso: npm run nueva-tienda
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { createInterface } from "node:readline";
import { stdin as input, stdout as output } from "node:process";

// Cola de líneas: funciona igual en terminal interactiva y con respuestas por pipe.
const rl = createInterface({ input, output, terminal: input.isTTY });
const lines = [];
const waiting = [];
rl.on("line", (line) => (waiting.length ? waiting.shift()(line) : lines.push(line)));
rl.on("close", () => waiting.splice(0).forEach((resolve) => resolve("")));
const ask = async (label, def = "") => {
  output.write(`${label}${def ? ` [${def}]` : ""}: `);
  const answer = lines.length ? lines.shift() : await new Promise((resolve) => waiting.push(resolve));
  return answer.trim() || def;
};

console.log("\n🛍️  Nueva tienda — configuración de marca y Supabase\n");
if (existsSync(".env") && (await ask("Ya existe .env, ¿sobrescribir? (s/n)", "n")).toLowerCase() !== "s") {
  rl.close();
  process.exit(0);
}

const name = await ask("Nombre de la tienda", "Manojitos");
const domain = await ask("Dominio (sin https://)", `${name.toLowerCase().replace(/[^a-z0-9]+/g, "")}.com`);
const values = {
  VITE_BRAND_NAME: name,
  VITE_BRAND_DOMAIN: domain,
  VITE_BRAND_TAGLINE: await ask("Frase corta", "Tu tienda de confianza con los mejores productos."),
  VITE_BRAND_CONTACT_EMAIL: await ask("Correo de contacto", `contacto@${domain}`),
  VITE_BRAND_SUPPORT_EMAIL: await ask("Correo de soporte", `soporte@${domain}`),
  VITE_BRAND_INSTAGRAM: await ask("Instagram (sin @)", domain.split(".")[0]),
  VITE_BRAND_STORAGE_KEY: domain.split(".")[0].toLowerCase(),
  VITE_ASSISTANT_NAME: await ask("Nombre de la asistente IA", "Ángela"),
  VITE_GTM_ID: await ask("Google Tag Manager ID (opcional)"),
  VITE_SUPABASE_URL: await ask("Supabase Project URL (https://<ref>.supabase.co)"),
  VITE_SUPABASE_PUBLISHABLE_KEY: await ask("Supabase anon/publishable key"),
  VITE_VAPID_PUBLIC_KEY: await ask("VAPID public key (opcional, push)"),
};
values.VITE_SUPABASE_PROJECT_ID = values.VITE_SUPABASE_URL.match(/https:\/\/([^.]+)\./)?.[1] ?? "";
rl.close();

let env = readFileSync(".env.example", "utf8");
for (const [key, value] of Object.entries(values)) {
  env = env.replace(new RegExp(`^${key}=.*$`, "m"), `${key}=${JSON.stringify(value)}`);
}
writeFileSync(".env", env);

console.log(`\n✅ .env creado para ${name}.
Siguientes pasos (detalle en PLANTILLA.md):
  1. Reemplaza logos: src/assets/logo.jpeg, public/logo.jpeg y los favicons de public/
  2. Carga estas mismas variables en Vercel y apunta el dominio ${domain}
  3. Base de datos: Vault (project_url, anon_key) → migraciones → secretos → edge functions\n`);
