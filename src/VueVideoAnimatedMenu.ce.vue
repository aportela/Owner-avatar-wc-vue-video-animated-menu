<template>
  <div v-if="streamSource && streamMimeType" poster="poster" :style="containerStyle">
    <div class="columns">
      <div id="column is-narrow">
        <ul>
          <li v-for="children in menuData.children" :key="children.id" v-if="showVideoDots">{{ children.label }}</li>
        </ul>
      </div>
      <div id="column">
        <div id="video-container">
          <video ref="videoRef" :width="width" :height="height" autobuffer preload="auto"
            :controls="showNativeVideoControls" @canplaythrough.once="onVideoLoaded" @seeking="onVideoSeeking"
            @seeked="onVideoSeeked" @play="onVideoPlay" @ended="onVideoEnded" @mousemove="onMouseMoveOverVideo">
            <source :src="streamSource" :type="streamMimeType">
          </video>
          <Transition>
            <div id="video-dots" v-if="showVideoDots">
              <span class="dot" v-for="children in menuData.children" :key="children.id" :title="children.dot.hint"
                :style="'top: ' + children.dot.y + 'px; left: ' + children.dot.x + 'px;'">{{
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
      <p>Resolution: {{ width }}x{{ height }} <span v-if="width != videoData.width || height != videoData.height">(video
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
</template>

<style scoped></style>

<script setup lang="ts">

import { ref, withDefaults, watch } from 'vue'
import type { Ref } from 'vue'

const menuData = {
  id: '0',
  title: 'main',
  src: 'blender-demo-cube-diorama.mp4',
  children: [
    {
      id: '1',
      title: 'main',
      label: 'children 1',
      dot: {
        label: '1',
        hint: 'one',
        x: 99,
        y: 186
      },
      src: 'blender-demo-cube-diorama.mp4',
    },
    {
      id: '2',
      title: 'main',
      label: 'children 2',
      dot: {
        label: '2',
        hint: 'two',
        x: 252,
        y: 244
      },
      src: 'blender-demo-cube-diorama.mp4',
    },
    {
      id: '3',
      title: 'main',
      label: 'children 3',
      dot: {
        label: '3',
        hint: 'three',
        x: 324,
        y: 166
      },
      src: 'blender-demo-cube-diorama.mp4',
    },
    {
      id: '4',
      title: 'main',
      label: 'children 4',
      dot: {
        label: '4',
        hint: 'four',
        x: 351,
        y: 272
      },
      src: 'blender-demo-cube-diorama.mp4',
    }
  ]
}

interface Props {
  width: number,
  height: number,
  poster?: string,
  streamSource: string,
  streamMimeType: string,
  streamFps: number,
  streamRangeFrom?: number,
  streamRangeTo?: number,
  showNativeVideoControls?: boolean,
  hideSlider?: boolean,
  seekOnMouseMove?: boolean,
  showDebugData?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  streamRangeFrom: -1,
  streamRangeTo: -1,
  showNativeVideoControls: false,
  hideSlider: false,
  seekOnMouseMove: false,
  showDebugData: false
})

const emit = defineEmits<{
  (e: 'loaded', value: boolean): void
  (e: 'seeking', value: boolean): void
  (e: 'seeked', value: boolean): void
}>()

interface VideoInfo {
  width: number,
  height: number,
  fps: number,
  duration: number,
  totalFrames: number
}

interface VideoFrameRange {
  custom: boolean,
  fromSecond: number,
  toSecond: number,
  totalSeconds: number,
  fromFrame: number,
  toFrame: number,
  totalFrames: number
}

const videoData: Ref<VideoInfo> = ref({ width: 0, height: 0, fps: 0, duration: 0, totalFrames: 0 })
const videoRef = ref<HTMLVideoElement | null>(null)

const loadComplete: Ref<boolean> = ref(false)
const seeking: Ref<boolean> = ref(false)

const currentTime: Ref<number> = ref(0)
const currentFrameIndex: Ref<number> = ref(0)

const range: Ref<VideoFrameRange> = ref({ custom: false, fromSecond: 0, toSecond: 0, totalSeconds: 0, fromFrame: 0, toFrame: 0, totalFrames: 0 })

const defaultFPS = 25

const containerStyle = "width: " + props.width + "px;"

const showVideoDots: Ref<boolean> = ref(false)
const mouseX: Ref<number> = ref(0)
const mouseY: Ref<number> = ref(0)

watch(currentFrameIndex, (newValue: number) => {
  if (!seeking.value) {
    currentTime.value = Number((
      newValue / videoData.value.fps
    ).toPrecision(3))
    if (videoRef && videoRef.value) {
      videoRef.value.currentTime = currentTime.value
    }
  }
})

function onVideoLoaded(e: any) {
  if (videoRef && videoRef.value) {
    videoRef.value.playbackRate = 8
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
  emit('loaded', true)
}

function onVideoPlay() {
  showVideoDots.value = false
}

function onVideoSeeking() {
  seeking.value = true
  emit('seeking', true)
}

function onVideoSeeked() {
  seeking.value = false
  emit('seeked', true)
}

function onVideoEnded() {
  showVideoDots.value = true
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

</script>

<style>
div#video-container {
  position: relative;
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
  border-radius: 10px;
  /*
  warning padding affects static coordinates
  */
  padding: 0.4em;
  font-weight: bold;
  cursor: pointer;
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