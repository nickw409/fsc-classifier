const CONSUMER_PROVIDERS = new Set([
  "gmail.com",
  "yahoo.com",
  "outlook.com",
  "hotmail.com",
  "aol.com",
  "protonmail.com",
  "proton.me",
  "icloud.com",
  "live.com",
  "msn.com",
]);

export function deriveUrlFromEmail(email: string | undefined): string | undefined {
  if (!email) return undefined;
  const at = email.indexOf("@");
  if (at < 0) return undefined;
  const domain = email.slice(at + 1).trim().toLowerCase();
  if (!domain || !domain.includes(".")) return undefined;
  if (CONSUMER_PROVIDERS.has(domain)) return undefined;
  return `https://${domain}`;
}

export function isConsumerEmail(email: string | undefined): boolean {
  if (!email) return false;
  const at = email.indexOf("@");
  if (at < 0) return false;
  return CONSUMER_PROVIDERS.has(email.slice(at + 1).trim().toLowerCase());
}
