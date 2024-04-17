<template>
  <div :class="class">
    <div v-if="loadingConfiguration">
      <!-- credits: https://github.com/n3r4zzurr0/svg-spinners -->
      <svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 24 24">
        <path fill="currentColor" d="M12,1A11,11,0,1,0,23,12,11,11,0,0,0,12,1Zm0,19a8,8,0,1,1,8-8A8,8,0,0,1,12,20Z"
          opacity=".25" />
        <path fill="currentColor"
          d="M12,4a8,8,0,0,1,7.89,6.7A1.53,1.53,0,0,0,21.38,12h0a1.5,1.5,0,0,0,1.48-1.75,11,11,0,0,0-21.72,0A1.5,1.5,0,0,0,2.62,12h0a1.53,1.53,0,0,0,1.49-1.3A8,8,0,0,1,12,4Z">
          <animateTransform attributeName="transform" dur="0.75s" repeatCount="indefinite" type="rotate"
            values="0 12 12;360 12 12" />
        </path>
      </svg>
    </div>
    <div v-else-if="configurationErrors">
      Error!
    </div>
    <div v-else-if="configuration">
      <div class="columns">
        <div id="column is-narrow">
          <ul>
            <li v-for="item in currentMenuItems" :key="item.id" v-if="showVideoDots">{{
    item.label }}</li>
          </ul>
        </div>
        <div id="column">
          <div id="video-container">
            <video id="video" autoplay ref="videoRef" :width="configuration.width" :height="configuration.height"
              autobuffer preload="auto" :controls="false" @mousemove="onMouseMoveOverVideo"
              @canplaythrough.once="onVideoLoaded" @seeking="onVideoSeeking" @seeked="onVideoSeeked"
              @ended="onVideoEnded">
              <source :src="currentNode.source" :type="currentNode.mime">
            </video>
            <canvas id="canvas" ref="canvasRef" :width="configuration.width" :height="configuration.height"></canvas>
            <Transition>
              <div id="video-dots" v-if="showVideoDots">
                <span class="dot" v-for="children in currentNode.children" :key="children.id" :title="children.dot.hint"
                  :style="getDotStyle(children.dot.x, children.dot.y)" @click="onDotClick(children)">{{
    children.dot.label }}</span>
              </div>
            </Transition>
          </div>
          <input style="width: 100%" type="range" :min="range.fromFrame" :max="range.toFrame" step="1"
            v-model="currentFrameIndex" v-if="!hideSlider" :disable="!loadComplete">
        </div>
      </div>
      <slot name="debug" :currentFrameIndex="currentFrameIndex" :currentTime="currentTime" :videoData="videoData"
        :range="range" :seeking="seeking" v-if="showDebugData">
        <p>Resolution: {{ width }}x{{ height }} <span
            v-if="width != videoData.width || height != videoData.height">(video
            scaled from: {{ videoData.width }}x{{
    videoData.height }})</span> ({{ videoData.fps }} fps)</p>
        <p>Frame: {{ currentFrameIndex - range.fromFrame }} / {{ range.toFrame - range.fromFrame }}
          <span v-if="range.custom">(video real frame: {{ currentFrameIndex }} / {{ videoData.totalFrames }})</span>
          <span class="has-text-white has-background-black" v-show="seeking">(SEEKING)</span>
        </p>
        <p>Timeline second: {{ (currentTime - range.fromSecond).toPrecision(3) }} / {{ (range.toSecond -
    range.fromSecond).toPrecision(3) }}
          <span v-if="range.custom">(video real timeline second: {{ currentTime }} / {{
    videoData.duration.toPrecision(3)
            }})</span>
        </p>
        <p>
          Mouse coordinates: {{ mouseX }}x{{ mouseY }}
        </p>
      </slot>
    </div>
  </div>
</template>

<script setup lang="ts">

import { ref, withDefaults, watch, computed } from 'vue'
import type { Ref } from 'vue'

interface Props {
  class?: string,
  config?: string,
  showNativeVideoControls?: boolean,
  hideSlider?: boolean,
  seekOnMouseMove?: boolean,
  showDebugData?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  showNativeVideoControls: false,
  hideSlider: false,
  seekOnMouseMove: false,
  showDebugData: false
})

/*
const emit = defineEmits<{
  (e: 'loaded', value: boolean): void
  (e: 'seeking', value: boolean): void
  (e: 'seeked', value: boolean): void
}>()
*/

interface VideoFrameRange {
  custom: boolean,
  fromSecond: number,
  toSecond: number,
  totalSeconds: number,
  fromFrame: number,
  toFrame: number,
  totalFrames: number
}

interface VideoInfo {
  width: number,
  height: number,
  fps: number,
  playbackRate: number,
  duration: number,
  totalFrames: number,
  range: VideoFrameRange
}


const defaultFPS = 25

const videoRef = ref<HTMLVideoElement | null>(null)
const canvasRef = ref<HTMLVideoElement | null>(null)

const showVideoDots: Ref<boolean> = ref(false)

const mouseX: Ref<number> = ref(0)
const mouseY: Ref<number> = ref(0)


const currentNode: Ref<Object> = ref({
  source: null,
  mime: null,
  fps: 25,
  playbackRate: 1
});

const previousNode = null;

const loadingConfiguration: Ref<boolean> = ref(true)
const configurationErrors: Ref<boolean> = ref(false)

const configuration: Ref<Object | null> = ref(null);

if (props.config) {
  fetch(props.config)
    .then(response => {
      if (!response.ok) {
        throw new Error('HTTP ' + response.status + ': ' + response.statusText);
      }
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        return response.json();
      } else {
        throw new Error('Invalid configuration format (JSON required)');
      }
    })
    .then(data => {
      if (!(data.root.type == "video" && data.root.mime && data.root.fps > 0 && data.root.source)) { // at this time, only video is supported
        configurationErrors.value = true;
      } else {
        configuration.value = data;
        currentNode.value.source = data.root.source;
        currentNode.value.mime = data.root.mime;
        currentNode.value.children = data.root.children;
        currentNode.value.fps = data.root.fps || 25;
        currentNode.value.playbackRate = data.root.playbackRate || 1;
      }
    })
    .catch(error => {
      console.error('Configuration loading error: ', error);
      configurationErrors.value = true;
    })
    .finally(() => {
      loadingConfiguration.value = false;
    }
    )
}

const currentMenuItems = computed(() => {
  return (configuration.value && configuration.value.root && configuration.value.root.children && configuration.value.root.children.length > 0 ? configuration.value.root.children : []);
})


const videoData: Ref<VideoInfo> = ref({ width: 0, height: 0, fps: 0, playbackRate: 0, duration: 0, totalFrames: 0 })

const loadComplete: Ref<boolean> = ref(false)
const seeking: Ref<boolean> = ref(false)

const currentTime: Ref<number> = ref(0)
const currentFrameIndex: Ref<number> = ref(0)

const range: Ref<VideoFrameRange> = ref({ custom: false, fromSecond: 0, toSecond: 0, totalSeconds: 0, fromFrame: 0, toFrame: 0, totalFrames: 0 })


watch(currentFrameIndex, (newValue: number) => {
  if (!seeking.value) {
    currentTime.value = Number((
      newValue / videoData.value.fps
    ).toPrecision(3))
    if (videoRef && videoRef.value) {
      videoRef.value.currentTime = currentTime.value
    }
  } else {
    showVideoDots.value = videoData.value.totalFrames == currentFrameIndex.value
  }
})

function onVideoLoaded(e: any) {
  if (videoRef && videoRef.value) {
    videoRef.value.playbackRate = currentNode.value.playbackRate;
    videoData.value = {
      width: videoRef.value.videoWidth,
      height: videoRef.value.videoHeight,
      fps: props.streamFps || defaultFPS,
      duration: e.target.duration,
      totalFrames: Math.ceil(e.target.duration * (props.streamFps || defaultFPS))
    }
  }
  if (props.streamRangeFrom <= 0 && props.streamRangeTo <= 0) {
    range.value = { custom: false, fromSecond: 0, toSecond: videoData.value.duration, totalSeconds: videoData.value.duration, fromFrame: 0, toFrame: videoData.value.totalFrames, totalFrames: videoData.value.totalFrames }
  } else {
    if (props.streamRangeFrom > 0 && props.streamRangeFrom < videoData.value.duration) {
      range.value.fromSecond = props.streamRangeFrom
      range.value.fromFrame = Math.ceil(range.value.fromSecond * (props.streamFps || defaultFPS))
      range.value.custom = true
    } else {
      range.value.fromSecond = 0
      range.value.fromFrame = 0
    }
    if (props.streamRangeTo > 0 && props.streamRangeTo <= videoData.value.duration) {
      range.value.toSecond = props.streamRangeTo
      range.value.toFrame = Math.ceil(range.value.toSecond * (props.streamFps || defaultFPS))
      range.value.custom = true
    } else {
      range.value.toSecond = videoData.value.duration
      range.value.toFrame = videoData.value.totalFrames
    }
    range.value.totalSeconds = range.value.toSecond - range.value.fromSecond
    range.value.totalFrames = range.value.toFrame - range.value.fromFrame
  }
  if (range.value.fromSecond > 0 && videoRef && videoRef.value) {
    currentFrameIndex.value = range.value.fromFrame
  }
  loadComplete.value = true
  //emit('loaded', true)
}

function onVideoPlay() {
  showVideoDots.value = false
}

function onVideoSeeking() {
  seeking.value = true
  //emit('seeking', true)
}

function onVideoSeeked() {
  seeking.value = false
  //emit('seeked', true)
}

function onVideoEnded() {
  showVideoDots.value = true
  if (videoRef && videoRef.value && canvasRef && canvasRef.value) {
    const canvas = canvasRef.value;
    const context = canvas.getContext('2d');
    context.drawImage(videoRef.value, 0, 0);
    videoRef.value.style.display = 'none';
    canvasRef.value.style.display = 'block';
  }
}

function onMouseMoveOverVideo(e: any) {
  const bounds = e.target.getBoundingClientRect()
  mouseX.value = e.clientX - bounds.left
  mouseY.value = e.clientY - bounds.top
  if (props.seekOnMouseMove) {
    currentFrameIndex.value = Math.round(
      (mouseX.value * range.value.totalFrames) / bounds.width
    ) + range.value.fromFrame
  }
}

function getDotStyle(x: number, y: number) {
  return ('left: ' + (x - 13) + 'px; top: ' + (y - 13) + 'px;')
}

function onDotClick(children: any) {
  currentNode.value.source = children.source;
  currentNode.value.mime = children.mime;
  currentNode.value.children = children.children;
  if (videoRef.value) {
    videoRef.value.src = children.source;
    videoRef.value?.play();
  }
}

</script>

<style scoped>
div#video-container {
  position: relative;
}

canvas {
  display: none;
  z-index: 0
}

video {
  z-index: 0
}

div#video-dots {
  position: absolute;
  top: 0;
  z-index: 1;
}

span.dot {
  position: absolute;
  background: pink;
  border: 1px solid red;
  border-radius: 13px;
  width: 24px;
  font-size: 21px;
  text-align: center;
  font-weight: bold;
  cursor: pointer;
  opacity: 0.6;
}

span.dot:hover {
  opacity: 1;
}

.v-enter-active,
.v-leave-active {
  transition: opacity 0.5s ease;
}

.v-enter-from,
.v-leave-to {
  opacity: 0;
}

div.columns {
  display: flex;
}

div.column {
  display: block;
  flex-basis: 0;
  flex-grow: 1;
  flex-shrink: 1;
}

div.column.is-narrow {
  flex: none;
  width: unset;

}

ul {
  width: 200px;
}

li {
  list-style-type: none;
  border: 1px solid #444;
  width: 160px;
  padding: 16px 20px;
  margin-bottom: 8px;
  cursor: pointer;
  background: pink;
}

li:hover {
  background: red;
}
</style>