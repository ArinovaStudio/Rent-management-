// fetch() that refreshes the session once if the access token has expired, then retries.
export async function authFetch(url: string, init: RequestInit) {
  let res = await fetch(url, init);
  if (res.status === 401 && (await fetch("/api/auth/refresh", { method: "POST" })).ok) {
    res = await fetch(url, init);
  }
  return res;
}
