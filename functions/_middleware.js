const SITE_PASSWORD = "diffy";
const COOKIE_NAME = "diffy_auth";

async function hashToken(value) {
  const enc = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", enc);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function loginPage(error) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>diffy1</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&display=swap" rel="stylesheet">
<style>
  html, body { height: 100%; margin: 0; }
  body {
    background: #fafaf8;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    font-family: "Space Grotesk", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    padding: 1.5rem;
    box-sizing: border-box;
  }
  h1 {
    font-size: 1.75rem;
    font-weight: 700;
    color: #1a1a1a;
    margin-bottom: 1.5rem;
    text-align: center;
  }
  form {
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 100%;
    max-width: 320px;
  }
  input[type="password"] {
    width: 100%;
    font-family: inherit;
    font-size: 1rem;
    padding: 0.65rem 1rem;
    border: 1px solid #ddd;
    border-radius: 999px;
    box-sizing: border-box;
    text-align: center;
  }
  button {
    margin-top: 1rem;
    padding: 0.65rem 1.5rem;
    font-family: inherit;
    font-size: 1rem;
    font-weight: 600;
    color: #fafaf8;
    background: #1a1a1a;
    border: none;
    border-radius: 999px;
    cursor: pointer;
  }
  .error {
    margin-top: 0.75rem;
    font-size: 0.85rem;
    color: #e5484d;
  }
</style>
</head>
<body>
  <h1>diffy would know</h1>
  <form method="POST" action="/__auth">
    <input type="password" name="password" placeholder="password" autofocus required>
    <button type="submit">enter</button>
    ${error ? '<div class="error">wrong password, try again</div>' : ""}
  </form>
</body>
</html>`;
}

export async function onRequest({ request, next }) {
  const url = new URL(request.url);
  const cookie = request.headers.get("Cookie") || "";
  const match = cookie.match(/diffy_auth=([a-f0-9]+)/);
  const validToken = await hashToken(SITE_PASSWORD);

  if (request.method === "POST" && url.pathname === "/__auth") {
    const form = await request.formData();
    const password = form.get("password") || "";
    if (password === SITE_PASSWORD) {
      return new Response(null, {
        status: 302,
        headers: {
          "Location": "/",
          "Set-Cookie": `${COOKIE_NAME}=${validToken}; Path=/; HttpOnly; Secure; SameSite=Lax`,
        },
      });
    }
    return new Response(loginPage(true), {
      status: 401,
      headers: { "Content-Type": "text/html" },
    });
  }

  if (match && match[1] === validToken) {
    return next();
  }

  return new Response(loginPage(false), {
    status: 401,
    headers: { "Content-Type": "text/html" },
  });
}
