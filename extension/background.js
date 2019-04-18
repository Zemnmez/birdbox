// this extension needs to be
// whitelisted at launch time
// https://github.com/GoogleChrome/puppeteer/issues/2229#issuecomment-447390694

console.log("background script waiting for new tab");
/*
  wait for puppeteer to open the page
*/
const tab = await new Promise((ok, fail) =>
  chrome.tabs.onCreated.addListener((tab) => (!tab?fail:ok)(tab))
)

console.log("background script waiting for discord voice login deets");
/*
  we rely on puppeteer to send us a URL to send the voice / video
  stream target via a content script
*/
const { token, session_id, user_id, server_id, endpoint } = await new Promise((ok, fail) =>
  chrome.tabs.sendMessage(tab.id, {
    identifier: "birdbox",
  }, ({
    voice_connection: {
     token, session_id, user_id, server_id, endpoint
    }
  }) => ok({ token, session_id, user_id, server_id, endpoint }))
);

console.log("background script waiting for A/V tab mediaStream");
/*
 capture the audio / video of the current tab.
 discord's bot API unfortunately doesn't support sending video
 we could do it via the *actual* discord website but that would
 probably make discord sad
*/
const { mediaStream } = await new Promise((ok, fail) =>
  chrome.tabCapture.capture({
    audio: true,
    video: true,
  }, mediaStream => (!mediaStream?fail:ok)({ mediaStream }))
)

console.log("background script waiting to connect to discord voice server websocket");
/*
 connect to discord's audio server
 https://discordapp.com/developers/docs/topics/voice-connections#connecting-to-voice
*/
const sock = await new Promise((ok, fail) => {
  const sock = new WebSocket(`wss://${endpoint}`);
  sock.onOpen = () => ok(sock);
});

const send = async (json, filterFn) => await new Promise((ok, fail) => {
  sock.send(JSON.stringify(json));

  if (!filterFn) ok();

  let listener;
  listener = ({ data }) => {
    if (!filterFn({ data })) return;
    sock.removeEventListener("message", listener);
    ok(data);
  };

  sock.addEventListener("message", listener);
});


console.log("background script setting up heartbeat");
let heartbeat_wait_time;
let heartbeat_handle;
let heartbeat;
heartbeat = (after) = setTimeout(() => {
  send({ op: 3, d: Math.floor(Math.random * 1E16) })
  heartbeat_handle = heartbeat(heartbeat_wait_time);
}, after);

sock.addEventListener("message", ({ data: { op, d: heartbeat_interval }}) => {
  if (op != 8) return;
  heartbeat_wait_time = heartbeat_interval;
  if (!heartbeat_handle) heartbeat(heartbeat_wait_time);
});


console.log("background script waiting for login response");
/*
 log in
 https://discordapp.com/developers/docs/topics/voice-connections#establishing-a-voice-websocket-connection
*/
const {
  d: {
    ssrc, ip, port, modes, heartbeat_interval
  }
} = await new Promise((ok, fail) => {
  ok(await send({
    op: 0,
    d: { token, user_id, server_id, endpoint, session_id }
  }, ({ data }) => data.op == 2)) // READY payload
});

const mode = modes[0];

console.log("background script informing voice system of voice protocol selection");
const {
  d: { secret_key }
} = await new Promise((ok, fail) => {
  ok(await send({
    op: 4,
    d: { mode, port, address: ip }
  }, ({ data }) => data.op == 2))
});

console.log("background script informing voice server we would like to speak");
await send({
  op: 5,
  d: {
    speaking: true,
    delay: 0,
    ssrc
  }
});

console.log("background script requesting 48khz opus stream");
const [ audioTrack ] = mediaStream.getAudioTracks();
audioTrack.applyConstraints({
  sampleRate: 48000,
});
