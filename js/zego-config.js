// From your existing ZegoCloud "Obtain Configuration" screen.
// NOTE: ServerSecret is meant to stay on a server in production —
// generateKitTokenForTest() below is fine for development/small-scale
// use, but for a public launch move token generation to a small
// backend (e.g. a Cloud Function) so the secret isn't shipped to
// every browser. See README "Phase 4" for details.
const ZEGO_APP_ID = 308958390;
const ZEGO_SERVER_SECRET = "5ced61981ea0eac2f701297523a0190cd1378529";
