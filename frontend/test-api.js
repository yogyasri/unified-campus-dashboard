async function test() {
  const loginRes = await fetch("http://localhost:3000/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "alice@cs.iitr.in", password: "password123" })
  });
  
  const cookies = loginRes.headers.get("set-cookie");
  console.log("Cookie:", cookies);

  const rsvpsRes = await fetch("http://localhost:3000/api/events/my-rsvps", {
    headers: { "Cookie": cookies }
  });
  console.log("RSVPs:", await rsvpsRes.text());

  const bmRes = await fetch("http://localhost:3000/api/notifications/my-bookmarks", {
    headers: { "Cookie": cookies }
  });
  console.log("Bookmarks:", await bmRes.text());
}
test();
