import { setupConfig } from "./api/Config";

export const cfg = setupConfig({
  url: <string>"https://api.listenbrainz.org",
  apiKey: <string>"",
  enabled: <boolean>false,

  // NOUVELLES OPTIONS DE SCROBBLING :
  scrobbleMode: <string>"hybrid",
  minTrackDuration: <number>30,
  minListenTime: <number>30,
  listenPercentage: <number>50,
  maxListenTime: <number>240,
});

export function useConfig() {
  return cfg.value;
}
