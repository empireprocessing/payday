import { randomBytes } from "crypto";

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

export function generateShopifyLikeId({ length = 24, prefix = "hWN" } = {}) {
  if (prefix.length >= length) throw new Error("Le préfixe doit être plus court que la longueur totale.");
  const needed = length - prefix.length;
  let out = prefix;
  for (let i = 0; i < needed; i++) {
    const randomByte = randomBytes(1)[0];
    out += ALPHABET[randomByte % ALPHABET.length];
  }
  return out;
}

