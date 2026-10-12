const value = process.env.TARGET_URL;
if (!value) {
  throw new Error('Set TARGET_URL to the approved Cloudflare deployment or local development URL.');
}
const parsed = new URL(value);
if (!['http:', 'https:'].includes(parsed.protocol)) {
  throw new Error('TARGET_URL must use HTTP or HTTPS.');
}
if (['vercel.app', 'netlify.app'].some(host => parsed.hostname === host || parsed.hostname.endsWith(`.${host}`))) {
  throw new Error('Hosting: Cloudflare only. Never Vercel or Netlify.');
}
export const verificationTarget = parsed.href;
