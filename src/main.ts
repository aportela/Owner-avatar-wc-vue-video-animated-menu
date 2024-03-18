import { defineCustomElement } from 'vue'

import wcVueVideoAnimatedMenu from './VueVideoAnimatedMenu.ce.vue'

const wcVueVideoAnimatedMenuComponent = defineCustomElement(wcVueVideoAnimatedMenu);

customElements.define('wc-vue-video-animated-menu', wcVueVideoAnimatedMenuComponent)
