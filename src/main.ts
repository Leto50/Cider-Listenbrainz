import { defineCustomElement } from "./api/CustomElement/apiCustomElement.ts";
import { PluginAPI } from "./api/PluginAPI";
import settings from "./components/settings.vue";
import { customElementName } from "./utils";
import config from './plugin.config.ts'
import { createApp, h } from 'vue'
import { createPinia } from "pinia";
import { useMusicKit } from "./api/MusicKit.ts";
import { useConfig } from "./config.ts";

/**
 * Initializing a Vue app instance so we can use things like Pinia.
 */
const pinia = createPinia()
const pluginApp = createApp(h('div'));
pluginApp.use(pinia)

/**
 * Custom Elements that will be registered in the app
 */
export const CustomElements
    = {
    'settings': defineCustomElement(settings, {
        shadowRoot: false,
        appContext: pluginApp,
    }),
}

export default {
    name: 'ListenBrainz',
    identifier: config.identifier,
    /**
     * Defining our custom settings panel element
     */
    SettingsElement: customElementName('settings'),
    /**
     * Initial setup function that is executed when the plugin is loaded
     */
    setup() {
        // Temp workaround
        // @ts-ignore
        window.__VUE_OPTIONS_API__ = true
        for (const [key, value] of Object.entries(CustomElements)) {
            const _key = key as keyof typeof CustomElements;
            customElements.define(customElementName(_key), value)
        }

        const musickit = useMusicKit();

        let oldData: any = {};
        let trackStartTime = 0;
        let totalListenTime = 0;
        let lastUpdateTime = 0;
        let trackingInterval: NodeJS.Timeout | null = null;
        let hasScrobbled = false;

        // Function to check if we should scrobble according to configured rules
        function shouldScrobbleTrack(trackData: any, listenTime: number): boolean {
            const cfg = useConfig();
            const duration = trackData.attributes.durationInMillis / 1000;

            // Check minimum track duration
            if (duration < cfg.minTrackDuration) {
                return false;
            }

            let requiredTime: number;

            switch (cfg.scrobbleMode) {
                case "time":
                    requiredTime = cfg.minListenTime;
                    break;
                case "percentage":
                    requiredTime = (duration * cfg.listenPercentage) / 100;
                    break;
                case "hybrid":
                    requiredTime = Math.min(duration / 2, cfg.maxListenTime);
                    break;
                default:
                    requiredTime = 30;
            }

            return listenTime >= requiredTime;
        }

        // Function to scrobble the current track
        async function scrobbleCurrentTrack() {
            if (hasScrobbled || !oldData || Object.keys(oldData).length === 0) return;
            
            const cfg = useConfig();
            
            // Build additional metadata
            const additionalInfo: any = {
                media_player: "Cider",
                submission_client: "Cider",
                music_service: "music.apple.com",
                duration_ms: oldData.attributes.durationInMillis,
                total_listen_time: Math.floor(totalListenTime),
            };

            // Add ISRC if available (very useful for matching)
            if (oldData.attributes.isrc) {
                const isrcMatch = oldData.attributes.isrc.match(
                    /[A-Z]{2}-?\w{3}-?\d{2}-?\d{5}$/
                );
                if (isrcMatch) {
                    additionalInfo.isrc = isrcMatch[0];
                }
            }

            // Add track number if available
            if (
                oldData.attributes.trackNumber &&
                oldData.attributes.trackNumber > 0
            ) {
                additionalInfo.tracknumber = oldData.attributes.trackNumber;
            }
            
            const scrobble_data = {
                listen_type: "single",
                payload: [
                {
                    listened_at: oldData.listenedAt,
                    track_metadata: {
                        additional_info: additionalInfo,
                        artist_name: oldData.attributes.artistName,
                        track_name: oldData.attributes.name,
                        release_name: oldData.attributes.albumName,
                    },
                },
                ],
            };

            const request = new Request(`${cfg.url}/1/submit-listens`, {
                method: "POST",
                body: JSON.stringify(scrobble_data),
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Token ${cfg.apiKey}`,
                },
            });

            await fetch(request);
            hasScrobbled = true;
            console.info(`[ListenBrainz] Scrobbled: ${oldData.attributes.name} (${Math.floor(totalListenTime)}s listened)`);
        }

        // Function to start time tracking
        function startTimeTracking() {
            if (trackingInterval) {
                clearInterval(trackingInterval);
            }
            trackStartTime = Date.now();
            totalListenTime = 0;
            lastUpdateTime = Date.now();
            hasScrobbled = false;
            
            trackingInterval = setInterval(async () => {
                if (musickit.isPlaying && oldData && Object.keys(oldData).length > 0) {
                    const now = Date.now();
                    const elapsed = (now - lastUpdateTime) / 1000;
                    
                    if (elapsed > 0 && elapsed < 10) { // Avoid large time jumps
                        totalListenTime += elapsed;
                        
                        // Check if we should auto-scrobble
                        if (!hasScrobbled && shouldScrobbleTrack(oldData, totalListenTime)) {
                            await scrobbleCurrentTrack();
                        }
                    }
                    
                    lastUpdateTime = now;
                }
            }, 1000); // Update every second
        }

        // Function to stop tracking
        function stopTimeTracking() {
            if (trackingInterval) {
                clearInterval(trackingInterval);
                trackingInterval = null;
            }
        }

        musickit.addEventListener('playbackStateDidChange', async () => {
            const cfg = useConfig();
            if (!cfg.enabled) return;
            let currentOldData = oldData;
            const currentItem = musickit.nowPlayingItem;

            if (Object.keys(currentOldData).length === 0) return;
  
            if (!currentItem && musickit.queue._nextPlayableItemIndex === -1) {
                // Check if we should scrobble according to new rules
                if (shouldScrobbleTrack(currentOldData, totalListenTime)) {
                    // Build additional metadata
                    const additionalInfo: any = {
                        media_player: "Cider",
                        submission_client: "Cider",
                        music_service: "music.apple.com",
                        duration_ms: currentOldData.attributes.durationInMillis,
                        total_listen_time: Math.floor(totalListenTime),
                    };

                    // Add ISRC if available
                    if (currentOldData.attributes.isrc) {
                        const isrcMatch = currentOldData.attributes.isrc.match(
                            /[A-Z]{2}-?\w{3}-?\d{2}-?\d{5}$/
                        );
                        if (isrcMatch) {
                            additionalInfo.isrc = isrcMatch[0];
                        }
                    }

                    // Add track number if available
                    if (
                        currentOldData.attributes.trackNumber &&
                        currentOldData.attributes.trackNumber > 0
                    ) {
                        additionalInfo.tracknumber = currentOldData.attributes.trackNumber;
                    }
                    
                    const scrobble_data = {
                        listen_type: "single",
                        payload: [
                        {
                            listened_at: currentOldData.listenedAt,
                            track_metadata: {
                                additional_info: additionalInfo,
                                artist_name: currentOldData.attributes.artistName,
                                track_name: currentOldData.attributes.name,
                                release_name: currentOldData.attributes.albumName,
                            },
                        },
                        ],
                    };

                    // Clear old data before POSTing as the await causes issues due to this event firing like 3 times in a row
                    oldData = {};
                    currentOldData = {};

                    const request = new Request(`${cfg.url}/1/submit-listens`, {
                        method: "POST",
                        body: JSON.stringify(scrobble_data),
                        headers: {
                            "Content-Type": "application/json",
                            "Authorization": `Token ${cfg.apiKey}`,
                        },
                    });

                    await fetch(request);
                    console.info(`[ListenBrainz] Scrobbled: ${currentOldData.attributes?.name} (${Math.floor(totalListenTime)}s listened)`);
                }
                
                stopTimeTracking();
            }
        })

        musickit.addEventListener('mediaItemStateDidChange', async () => {
            const cfg = useConfig();
            if (!cfg.enabled) return;
            const currentOldData = oldData;
            const currentItem = musickit.nowPlayingItem;

            // Check if PlayingItem exists first as this triggers even while it still isn't set
            if (!currentItem) return;
            // Check if oldData is populated and if it is the same id as the event fires a few times before the currentItem switches over.
            if (Object.keys(currentOldData).length > 0 && currentItem.id === currentOldData.id) return;

            // Scrobble previous track if it meets rules and not already scrobbled
            if (Object.keys(currentOldData).length !== 0) {
                if (!hasScrobbled && shouldScrobbleTrack(currentOldData, totalListenTime)) {
                    // Build additional metadata
                    const additionalInfo: any = {
                        media_player: "Cider",
                        submission_client: "Cider",
                        music_service: "music.apple.com",
                        duration_ms: currentOldData.attributes.durationInMillis,
                        total_listen_time: Math.floor(totalListenTime),
                    };

                    // Add ISRC if available
                    if (currentOldData.attributes.isrc) {
                        const isrcMatch = currentOldData.attributes.isrc.match(
                            /[A-Z]{2}-?\w{3}-?\d{2}-?\d{5}$/
                        );
                        if (isrcMatch) {
                            additionalInfo.isrc = isrcMatch[0];
                        }
                    }

                    // Add track number if available
                    if (
                        currentOldData.attributes.trackNumber &&
                        currentOldData.attributes.trackNumber > 0
                    ) {
                        additionalInfo.tracknumber = currentOldData.attributes.trackNumber;
                    }
                    
                    const scrobble_data = {
                        listen_type: "single",
                        payload: [
                        {
                            listened_at: currentOldData.listenedAt,
                            track_metadata: {
                                additional_info: additionalInfo,
                                artist_name: currentOldData.attributes.artistName,
                                track_name: currentOldData.attributes.name,
                                release_name: currentOldData.attributes.albumName,
                            },
                        },
                        ],
                    };

                    const request2 = new Request(`${cfg.url}/1/submit-listens`, {
                        method: "POST",
                        body: JSON.stringify(scrobble_data),
                        headers: {
                            "Content-Type": "application/json",
                            "Authorization": `Token ${cfg.apiKey}`,
                        },
                    });
                    await fetch(request2);
                    console.info(`[ListenBrainz] Scrobbled: ${currentOldData.attributes.name} (${Math.floor(totalListenTime)}s listened)`);
                } else if (hasScrobbled) {
                    console.info(`[ListenBrainz] Already scrobbled: ${currentOldData.attributes.name}`);
                } else {
                    console.info(`[ListenBrainz] Not scrobbled: ${currentOldData.attributes.name} (${Math.floor(totalListenTime)}s listened, not enough)`);
                }
            }

            oldData = musickit.nowPlayingItem;
            oldData.listenedAt = Math.floor(new Date().getTime() / 1000);

            // Start time tracking for new track
            startTimeTracking();

            const playing_data = {
                listen_type: "playing_now",
                payload: [
                  {
                    track_metadata: {
                      additional_info: {
                        media_player: "Cider",
                        submission_client: "Cider",
                        music_service: "music.apple.com",
                        duration_ms: currentItem.attributes.durationInMillis,
                      },
                      artist_name: currentItem.attributes.artistName,
                      track_name: currentItem.attributes.name,
                    },
                  },
                ],
            };

            const request = new Request(`${cfg.url}/1/submit-listens`, {
                method: "POST",
                body: JSON.stringify(playing_data),
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Token ${cfg.apiKey}`,
                },
            });
            await fetch(request);
            
            console.info(`[ListenBrainz] Now Playing: ${currentItem.attributes.name}`);
        })

        return () => {
            stopTimeTracking();
        };
    },
} as PluginAPI