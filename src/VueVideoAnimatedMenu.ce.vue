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
          <ul v-if="currentMenuItems && currentMenuItems.length > 0">
            <li v-for="item in currentMenuItems" :key="item.id" v-show="showMenu" @click="onDotClick(item)">{{
    item.label }}</li>
          </ul>
          <ul v-else>
            <li v-show="showMenu" @click="onBack">Back</li>
          </ul>
        </div>
        <div id="column">
          <div id="video-container">
            <video v-if="current" id="video" ref="videoRef" :controls="true" :width="configuration.width"
              :height="configuration.height" autobuffer preload="auto" @mousemove="onMouseMoveOverVideo"
              @canplaythrough="onVideoLoaded" @seeking="onVideoSeeking" @seeked="onVideoSeeked" @ended="onVideoEnded">
              <source :src="current.source" :type="current.mime">
            </video>
            <canvas id="canvas" ref="canvasRef" :width="configuration.width" :height="configuration.height"></canvas>
            <Transition>
              <div id="video-dots" v-if="showVideoDots">
                <span class="dot" v-for="children in current.children" :key="children.id" :title="children.dot.hint"
                  :style="getDotStyle(children.dot.x, children.dot.y)" @click="onDotClick(children)">{{
    children.dot.label }}</span>
              </div>
            </Transition>
          </div>
          <input style="width: 100%" type="range" :min="current.range.fromFrame" :max="current.range.toFrame" step="1"
            v-model="currentFrameIndex" v-if="!hideSlider" :disable="!videoLoadedComplete">
          <slot name="debug" :currentFrameIndex="currentFrameIndex" :currentTime="currentTime" :videoData="current"
            :range="range" :seeking="seeking" v-if="showDebugData">
            <p>Resolution: {{ current.width }}x{{ current.height }} ({{ current.fps }} fps)</p>
            <p>Frame: {{ currentFrameIndex - current.range.fromFrame }} / {{ current.range.toFrame -
    current.range.fromFrame }}
              <span v-if="current.range.custom">(video real frame: {{ currentFrameIndex }} / {{ current.totalFrames
                }})</span>
              <span class="has-text-white has-background-black" v-show="seeking">(SEEKING)</span>
            </p>
            <p>Timeline second: {{ (currentTime - current.range.fromSecond).toPrecision(3) }} / {{
    (current.range.toSecond -
      current.range.fromSecond).toPrecision(3) }}
              <span v-if="current.range.custom">(video real timeline second: {{ currentTime }} / {{
    current.duration.toPrecision(3)
                }})</span>
            </p>
          </slot>

        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">

import { ref, withDefaults, watch, computed } from 'vue'
import type { Ref } from 'vue'

interface Props {
  class?: string,
  config: string,
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
  range?: VideoFrameRange,
  source: string,
  mime: string,
  children: Array<VideoInfo>
}


const defaultFPS = 25

const videoRef = ref<HTMLVideoElement | null>(null)
const canvasRef = ref<HTMLVideoElement | null>(null)

const showMenu: Ref<boolean> = ref(false)
const showVideoDots: Ref<boolean> = ref(false)

const mouseX: Ref<number> = ref(0)
const mouseY: Ref<number> = ref(0)


const current: Ref<VideoInfo | null> = ref(null);

/*
const currentNode: Ref<Object> = ref({
  source: null,
  mime: null,
  fps: 25,
  playbackRate: 1
});
*/

const loadingConfiguration: Ref<boolean> = ref(true)
const configurationErrors: Ref<boolean> = ref(false)

const configuration: Ref<Object | null> = ref(null);

function setCurrent(node: any, autoplay: boolean) {
  let customRange = {
    custom: false,
    fromSecond: 0,
    toSecond: 0,
    totalSeconds: 0,
    fromFrame: 0,
    toFrame: 0,
    totalFrames: 0
  }
  if (node.range && node.range.from >= 0 && node.range.to > node.range.from) {
    customRange.custom = true;
    if (node.range.from >= 0) {
      customRange.fromSecond = node.range.from;
    }
    if (node.range.to >= 0) {
      customRange.toSecond = node.range.to;
    }
  }
  current.value = {
    width: 0,
    height: 0,
    fps: node.fps,
    playbackRate: node.playbackRate,
    duration: 0,
    totalFrames: 0,
    range: customRange,
    source: node.source,
    mime: node.mime,
    children: node.children || []
  };
  showVideo();
  if (autoplay) {
    videoRef.value?.load();
  }
}


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
        setCurrent(data.root);
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
  return (current.value && current.value.children && current.value.children.length > 0 ? current.value.children : []);
})


//const videoData: Ref<VideoInfo> = ref({ width: 0, height: 0, fps: 0, playbackRate: 0, duration: 0, totalFrames: 0 })

const videoLoadedComplete: Ref<boolean> = ref(false)
const seeking: Ref<boolean> = ref(false)

const currentTime: Ref<number> = ref(0)
const currentFrameIndex: Ref<number> = ref(0)

const range: Ref<VideoFrameRange> = ref({ custom: false, fromSecond: 0, toSecond: 0, totalSeconds: 0, fromFrame: 0, toFrame: 0, totalFrames: 0 })


watch(currentFrameIndex, (newValue: number) => {
  if (!seeking.value) {
    currentTime.value = Number((
      newValue / current.value.fps
    ).toPrecision(3))
    if (videoRef && videoRef.value) {
      videoRef.value.currentTime = currentTime.value
    }
    // WARNING: TODO: RANGES!
    if (currentTime.value < current.value.duration) {
      showVideo();
    } else {
      showCanvas();
    }
  } else {
    showVideoDots.value = current.value.totalFrames == currentFrameIndex.value
    showMenu.value = showVideoDots.value;
    if (!showVideoDots.value) {
      showVideo();
    } else {
      showCanvas();
    }
  }
})

function onVideoLoaded(e: any) {
  if (videoRef && videoRef.value) {
    videoRef.value.playbackRate = current.value.playbackRate;
    current.value.width = videoRef.value.videoWidth;
    current.value.height = videoRef.value.videoHeight;
    current.value.duration = e.target.duration;
    current.value.totalFrames = Math.ceil(e.target.duration * (current.value.fps || defaultFPS))
    /*
    videoData.value = {
      width: videoRef.value.videoWidth,
      height: videoRef.value.videoHeight,
      fps: props.streamFps || defaultFPS,
      duration: e.target.duration,
      totalFrames: Math.ceil(e.target.duration * (props.streamFps || defaultFPS))
    }
    */
  }
  if (!current.value.range.custom) {
    current.value.range = {
      custom: false,
      fromSecond: 0,
      toSecond: current.value.duration,
      totalSeconds: current.value.duration,
      fromFrame: 0,
      toFrame: current.value.totalFrames,
      totalFrames: current.value.totalFrames
    };
    //range.value = { custom: false, fromSecond: 0, toSecond: videoData.value.duration, totalSeconds: videoData.value.duration, fromFrame: 0, toFrame: videoData.value.totalFrames, totalFrames: videoData.value.totalFrames }
  } else {
    if (current.value.range.from > 0 && current.value.range.from < current.value.duration) {
      current.value.range.fromSecond = current.value.range.from;
      current.value.range.fromFrame = Math.ceil(current.value.range.fromSecond * (current.value.fps || defaultFPS))
      current.value.range.custom = true
    } else {
      current.value.range.fromSecond = 0
      current.value.range.fromFrame = 0
    }
    if (current.value.range.to > 0 && current.value.range.to <= current.value.duration) {
      current.value.range.toSecond = current.value.range.to;
      current.value.range.toFrame = Math.ceil(current.value.range.toSecond * (current.value.fps || defaultFPS))
      current.value.range.custom = true
    } else {
      current.value.range.toSecond = current.value.duration;
      current.value.range.toFrame = current.value.totalFrames;
    }
    current.value.range.totalSeconds = current.value.range.toSecond - current.value.range.fromSecond;
    current.value.range.totalFrames = current.value.range.toFrame - current.value.range.fromFrame;
  }
  if (current.value.range.fromSecond > 0 && videoRef && videoRef.value) {
    currentFrameIndex.value = current.value.range.fromFrame;
  }
  videoLoadedComplete.value = true
  videoRef.value?.play();
  //emit('loaded', true)
}

function onVideoPlay() {
  showVideoDots.value = false
  showMenu.value = showVideoDots.value;
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
  if (current.value && current.value.children && current.value.children.length > 0) {
    if (videoRef.value && canvasRef && canvasRef.value) {
      const canvas = canvasRef.value;
      const context = canvas.getContext('2d');
      context.drawImage(videoRef.value, 0, 0);
      showCanvas();
      showVideoDots.value = true;
      showMenu.value = showVideoDots.value;
    }
  }
}

function showVideo() {
  if (videoRef.value && canvasRef && canvasRef.value) {
    videoRef.value.style.display = 'block';
    canvasRef.value.style.display = 'none';
  }
}

function showCanvas() {
  if (videoRef.value && canvasRef && canvasRef.value) {
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
  /*
  currentNode.value.source = children.source;
  currentNode.value.mime = children.mime;
  currentNode.value.children = children.children;
  if (videoRef.value) {
    videoRef.value.src = children.source;
    videoRef.value?.play();
  }
  */
  setCurrent(children, true);
}

function onBack() {
  setCurrent(configuration.value.root, true);
}

</script>

<style scoped>
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


/* left menu list */
ul {
  width: 200px;
  display: block;
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
</style>