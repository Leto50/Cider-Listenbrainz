<script setup lang="ts">
import { useConfig } from "../config";

const cfg = useConfig();

function urlUpdate(e: KeyboardEvent) {
  //@ts-expect-error
  cfg.url = e.target!.value;
}

function keyUpdate(e: KeyboardEvent) {
  //@ts-expect-error
  cfg.apiKey = e.target!.value;
}

// Function to get mode description
function getModeDescription(mode: string): string {
  switch (mode) {
    case "hybrid":
      return "Scrobble after half the track OR maximum time (like Last.fm)";
    case "time":
      return "Scrobble after a fixed time, regardless of duration";
    case "percentage":
      return "Scrobble after a percentage of the total duration";
    default:
      return "";
  }
}

// Function to get scrobbling example
function getScrobbleExample(duration: number): string {
  if (duration < cfg.minTrackDuration) {
    return "Will not be scrobbled (too short)";
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

  const minutes = Math.floor(requiredTime / 60);
  const seconds = Math.round(requiredTime % 60);

  if (minutes > 0) {
    return `Scrobbled after ${minutes}min ${seconds}s`;
  } else {
    return `Scrobbled after ${seconds}s`;
  }
}
</script>

<template>
  <div class="q-px-lg plugin-base">
    <h3>ListenBrainz Settings</h3>

    <!-- Basic Configuration -->
    <div>
      <h4>Connection</h4>
      <div>
        <label> <input type="checkbox" v-model="cfg.enabled" /> Enable? </label>
      </div>
      <div>
        <label>
          ListenBrainz API
          <input class="c-input" type="text" :value="cfg.url" @keyup="urlUpdate($event)" />
        </label>
      </div>
      <div>
        <label>
          API Key
          <input class="c-input" type="text" :value="cfg.apiKey" @keyup="keyUpdate($event)" />
        </label>
      </div>
    </div>

    <!-- Scrobbling Options -->
    <div>
      <h4>Scrobbling Options</h4>

      <div>
        <label>
          Scrobbling Mode
          <select class="c-input" v-model="cfg.scrobbleMode">
            <option value="hybrid">Hybrid (recommended)</option>
            <option value="time">Fixed Time</option>
            <option value="percentage">Percentage</option>
          </select>
        </label>
        <small>{{ getModeDescription(cfg.scrobbleMode) }}</small>
      </div>

      <div>
        <label>
          Minimum Track Duration (seconds)
          <input
            class="c-input"
            type="number"
            v-model.number="cfg.minTrackDuration"
            min="0"
            max="300"
          />
        </label>
        <small>Tracks shorter than this will not be scrobbled</small>
      </div>

      <div v-if="cfg.scrobbleMode === 'time'">
        <label>
          Required Listen Time (seconds)
          <input
            class="c-input"
            type="number"
            v-model.number="cfg.minListenTime"
            min="5"
            max="600"
          />
        </label>
        <small
          >Scrobble after listening for this time, regardless of track duration</small
        >
      </div>

      <div v-if="cfg.scrobbleMode === 'percentage'">
        <label>
          Required Listen Percentage (%)
          <input
            class="c-input"
            type="range"
            v-model.number="cfg.listenPercentage"
            min="10"
            max="100"
            step="5"
          />
          <span>{{ cfg.listenPercentage }}%</span>
        </label>
        <small>Scrobble after listening to this percentage of the track</small>
      </div>

      <div v-if="cfg.scrobbleMode === 'hybrid'">
        <label>
          Maximum Listen Time (seconds)
          <input
            class="c-input"
            type="number"
            v-model.number="cfg.maxListenTime"
            min="30"
            max="600"
          />
        </label>
        <small
          >For long tracks, scrobble after this time instead of half duration</small
        >
      </div>
    </div>

    <!-- Rules Preview -->
    <div v-if="cfg.enabled">
      <h4>Current Rules Preview</h4>
      <div>
        <div>
          <strong>3-minute track:</strong> {{ getScrobbleExample(180) }}
        </div>
        <div>
          <strong>6-minute track:</strong> {{ getScrobbleExample(360) }}
        </div>
        <div>
          <strong>30-second track:</strong> {{ getScrobbleExample(30) }}
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped></style>