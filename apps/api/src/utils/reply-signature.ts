import crypto from "crypto";
import { env } from "../config/env.js";

/**
 * The AI concierge is stateless: the browser sends earlier turns back as history.
 * Assistant turns are signed when we produce them, so a client can't inject
 * fabricated "assistant" messages to steer the model.
 */
const KEY = Buffer.from(crypto.hkdfSync("sha256", env.JWT_SECRET, "hostnexus", "ai-reply-signature", 32));

function payload(content: string, listingIds: string[] | undefined): string {
  return JSON.stringify([content, listingIds ?? []]);
}

export function signReply(content: string, listingIds: string[] | undefined): string {
  return crypto.createHmac("sha256", KEY).update(payload(content, listingIds)).digest("hex");
}

export function verifyReply(content: string, listingIds: string[] | undefined, signature: string | undefined): boolean {
  if (!signature || !/^[a-f0-9]{64}$/.test(signature)) return false;
  const expected = Buffer.from(signReply(content, listingIds), "hex");
  return crypto.timingSafeEqual(expected, Buffer.from(signature, "hex"));
}
