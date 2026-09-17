const SITE_PASSWORD = "diffy";

export async function onRequest({ request, next }) {
  const authHeader = request.headers.get("Authorization");

  if (authHeader && authHeader.startsWith("Basic ")) {
    const decoded = atob(authHeader.slice(6));
    const password = decoded.includes(":") ? decoded.split(":").slice(1).join(":") : decoded;
    if (password === SITE_PASSWORD) {
      return next();
    }
  }

  return new Response("Authentication required", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="diffy1.com"',
      "Content-Type": "text/plain",
    },
  });
}
