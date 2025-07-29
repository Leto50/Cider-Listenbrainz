<script setup lang="ts">
import { useConfig } from "../config";

const cfg = useConfig();
const connectionStatus = ref<'unknown' | 'checking' | 'connected' | 'error'>('unknown');
const connectionMessage = ref('');

function urlUpdate(e: KeyboardEvent) {
  //@ts-expect-error
  cfg.url = e.target!.value;
  connectionStatus.value = 'unknown';
}

function keyUpdate(e: KeyboardEvent) {
  //@ts-expect-error
  cfg.apiKey = e.target!.value;
  connectionStatus.value = 'unknown';
}

async function testConnection() {
  if (!cfg.url || !cfg.apiKey) {
    connectionStatus.value = 'error';
    connectionMessage.value = 'URL and API Key required';
    return;
  }

  connectionStatus.value = 'checking';
  connectionMessage.value = 'Testing connection...';

  try {
    const response = await fetch(`${cfg.url}/1/validate-token`, {
      method: 'GET',
      headers: {
        'Authorization': `Token ${cfg.apiKey}`,
      },
    });

    if (response.ok) {
      const data = await response.json();
      if (data.valid === true) {
        connectionStatus.value = 'connected';
        connectionMessage.value = `Connected as ${data.user_name}`;
      } else {
        connectionStatus.value = 'error';
        connectionMessage.value = 'Invalid token';
      }
    } else {
      connectionStatus.value = 'error';
      connectionMessage.value = `Error: ${response.status} ${response.statusText}`;
    }
  } catch (error) {
    connectionStatus.value = 'error';
    connectionMessage.value = 'Connection failed';
  }
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
    <h3 class="settings-title">ListenBrainz Settings</h3>

    <div class="settings-grid">
      <!-- Basic Configuration -->
      <div>
        <h4>Connection</h4>
        <div class="settings-field checkbox-field">
          <label>
            <input type="checkbox" v-model="cfg.enabled" />
            <span>Enable ListenBrainz scrobbling</span>
          </label>
        </div>
        <div class="settings-field">
          <label>
            <span class="label-text">ListenBrainz API URL</span>
            <input 
              class="c-input" 
              type="text" 
              :value="cfg.url" 
              @keyup="urlUpdate($event)"
              placeholder="https://api.listenbrainz.org"
            />
          </label>
        </div>
        <div class="settings-field">
          <label>
            <span class="label-text">User Token</span>
            <input 
              class="c-input" 
              type="text" 
              :value="cfg.apiKey" 
              @keyup="keyUpdate($event)"
              placeholder="Your ListenBrainz token"
            />
          </label>
        </div>
        
        <div class="connection-test">
          <button 
            class="c-input test-button" 
            @click="testConnection" 
            :disabled="connectionStatus === 'checking'"
          >
            {{ connectionStatus === 'checking' ? 'Testing...' : 'Test Connection' }}
          </button>
          
          <span v-if="connectionStatus !== 'unknown'" 
                class="connection-status"
                :class="{
                  'status-connected': connectionStatus === 'connected',
                  'status-error': connectionStatus === 'error',
                  'status-checking': connectionStatus === 'checking'
                }">
            {{ connectionMessage }}
          </span>
        </div>
      </div>

      <!-- Scrobbling Options -->
      <div>
        <h4>Scrobbling Options</h4>

        <div class="settings-field">
          <label>
            <span class="label-text">Scrobbling Mode</span>
            <select class="c-input" v-model="cfg.scrobbleMode">
              <option value="hybrid">Hybrid (recommended)</option>
              <option value="time">Fixed Time</option>
              <option value="percentage">Percentage</option>
            </select>
          </label>
          <small>{{ getModeDescription(cfg.scrobbleMode) }}</small>
        </div>

        <div class="settings-field">
          <label>
            <span class="label-text">Min Track Duration (sec)</span>
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

        <div v-if="cfg.scrobbleMode === 'time'" class="settings-field">
          <label>
            <span class="label-text">Required Time (sec)</span>
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

        <div v-if="cfg.scrobbleMode === 'percentage'" class="settings-field">
          <label>
            <span class="label-text">Listen Percentage</span>
            <div class="range-input">
              <input
                class="c-input"
                type="range"
                v-model.number="cfg.listenPercentage"
                min="10"
                max="100"
                step="5"
              />
              <span class="range-value">{{ cfg.listenPercentage }}%</span>
            </div>
          </label>
          <small>Scrobble after listening to this percentage of the track</small>
        </div>

        <div v-if="cfg.scrobbleMode === 'hybrid'" class="settings-field">
          <label>
            <span class="label-text">Max Time (sec)</span>
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
      <div v-if="cfg.enabled" class="rules-preview">
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
  </div>
</template>

<style scoped>
.settings-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 40px;
  margin-bottom: 10px;
}

.settings-field {
  margin-bottom: 8px;
}

.settings-field label {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.settings-field .c-input {
  width: 160px;
}

.settings-field input[type="number"] {
  width: 80px;
}

.settings-field select {
  width: 160px;
}

.checkbox-field label {
  gap: 8px;
  justify-content: flex-start;
}

.checkbox-field input[type="checkbox"] {
  flex: none;
}

.label-text {
  width: 180px;
  font-weight: 500;
  flex-shrink: 0;
}

.range-input {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 120px;
  justify-content: flex-end;
}

.range-input input[type="range"] {
  flex: 1;
}

.range-value {
  width: 40px;
  text-align: right;
  font-weight: 500;
  flex-shrink: 0;
}

.settings-field small {
  display: block;
  margin-top: 5px;
  color: #888;
}

.connection-test {
  margin-top: 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.settings-title {
  margin-top: 5px;
  margin-bottom: 10px;
}


.test-button {
  padding: 5px 10px;
}

.connection-status {
  font-size: 14px;
}

.status-connected {
  color: #4caf50;
}

.status-error {
  color: #f44336;
}

.status-checking {
  color: #ff9800;
}

.rules-preview {
  grid-column: 1 / -1;
}

</style>