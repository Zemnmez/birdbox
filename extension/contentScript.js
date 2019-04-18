/*
 invite the page to give us discord login details
 (these are provided by the chrome instrumentation via a puppet
 eval() call)
*/
const { token, session_id, server_id, endpoint, heartbeat_interval } = await new Promise((ok, fail) =>
  window.postMessage({
    identifier: "birdbox",
    type: "please send discord login details. thanks."
  });

  console.log("contentScript awaiting voice login info");

  window.addEventListener("message", (event) => {
    if (event.source != window) return;
    if (event.data.identifier != "birdbox") return;
    ok(event.data.data);
  })
);

/*
  wait for the background script to ask us for the
  voice server login details
*/
console.log("contentScript waiting for background script server details request");
await new Promise((ok, fail) => {
  chrome.runtime.onMessage.addListener((message, sender, response) =>
    ok(response({ token, session_id, user_id, server_id, endpoint }))
  )
})
