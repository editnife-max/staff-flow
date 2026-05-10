import { createStart, createMiddleware } from "@tanstack/react-start";

import { renderErrorPage } from "./lib/error-page";

const errorMiddleware = createMiddleware().server(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    console.error(error);
    return new Response(renderErrorPage(), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
});

// Attach the Supabase access token to every server-fn request so server
// middleware (`requireSupabaseAuth`) can authenticate the caller.
const authedServerFnFetch: typeof fetch = async (input, init = {}) => {
  const headers = new Headers(init.headers);
  if (typeof window !== "undefined" && !headers.has("authorization")) {
    try {
      const { supabase } = await import("./integrations/supabase/client");
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (token) headers.set("authorization", `Bearer ${token}`);
    } catch {
      /* noop */
    }
  }
  return fetch(input, { ...init, headers });
};

export const startInstance = createStart(() => ({
  requestMiddleware: [errorMiddleware],
  serverFns: { fetch: authedServerFnFetch },
}));
