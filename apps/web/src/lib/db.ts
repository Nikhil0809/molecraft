import dns from "dns";

// Override dns.lookup to force IPv4 and prevent IPv6 connection timeouts inside Docker/WSL2
const originalLookup = dns.lookup;
// @ts-ignore
dns.lookup = function (hostname, options, callback) {
  if (typeof options === "function") {
    callback = options;
    options = {};
  } else if (typeof options === "number") {
    options = { family: options };
  }
  options = options || {};
  options.family = 4;
  // @ts-ignore
  return originalLookup.call(this, hostname, options, callback);
};

import { neon } from "@neondatabase/serverless";

export const sql = neon(process.env.DATABASE_URL!);

