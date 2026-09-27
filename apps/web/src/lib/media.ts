const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

/**
 * Resolve a stored media reference to a URL the browser can load.
 * - "/uploads/<id>" (canonical form stored by the API) → absolute API URL
 * - other same-origin paths ("/images/...") and http(s) URLs → unchanged
 * - anything else (javascript:, data: other than images, protocol-relative) → "" so it never renders
 */
export function mediaUrl(url: string | null | undefined): string {
  if (!url) return "";
  const u = url.trim();
  if (u.startsWith("/uploads/")) return `${API_BASE_URL}${u}`;
  if (u.startsWith("/") && !u.startsWith("//")) return u;
  if (/^https?:\/\//i.test(u)) return u;
  if (/^data:image\/(png|jpe?g|gif|webp);base64,/i.test(u)) return u;
  if (u.startsWith("blob:")) return u;
  return "";
}
