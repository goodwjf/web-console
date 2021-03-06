import Vue from "vue";
import App from "./App.vue";
import "./polyfill";
import { consoleHooks, filters, isFunction } from "@/utils";
import { pluginManager, Plugin } from "@/plugins";
import { PanelType } from "@/constants";
import InfiniteScroll from "vue-infinite-scroll";
import "./styles/_global.scss";

// register filters
Object.keys(filters).forEach(name => {
  Vue.filter(name, filters[name]);
});

// Fix: 避免重复注册插件（从 mint-ui 库引入和从 vue-infinite-scroll 引入是同一个插件的两个不同实例）
const installedPlugins = Vue._installedPlugins || [];
const foundIndex = installedPlugins.findIndex(plugin => isFunction(plugin.bind) && isFunction(plugin.unbind));
if (foundIndex === -1) {
  Vue.use(InfiniteScroll);
} else {
  console.warn('"vue-infinite-scroll" has been registered');
}

// const logger = new Logger("[main.js]");

// 放在可滚动容器上，在滚动触顶或触底时，可以阻止背景层滚动
Vue.directive("prevent-bkg-scroll", {
  bind(el) {
    let preventMove = false;
    el.addEventListener("touchstart", function() {
      // logger.log('touchstart scrollTop: %s, clientHeight: %s, scrollHeight: %s', el.scrollTop, el.clientHeight, el.scrollHeight)
      if (el.scrollTop <= 0) {
        // 滚动到顶部时将其设置为 1，避免触顶后不能向下滚动(IOS 上 scrollTop 会出现负数)
        el.scrollTop = 1;
        // 如果内容不足一屏，则禁用 touchmove
        if (el.scrollTop === 0) {
          preventMove = true;
        }
      } else if (el.scrollTop + el.clientHeight >= el.scrollHeight) {
        // 滚动到底部时，将滚动距离设置为最大可滚动距离 - 1，避免触底后不能向上滚动
        el.scrollTop = el.scrollHeight - el.clientHeight - 1;
        // 如果内容不足一屏
        if (el.scrollTop + el.clientHeight === el.scrollHeight) {
          preventMove = true;
        }
      }
    });
    el.addEventListener("touchmove", function(e) {
      if (preventMove) {
        e.preventDefault();
      }
    });
    el.addEventListener("touchend", function() {
      preventMove = false;
    });
  }
});

Vue.config.productionTip = false;

// WebConsole 只能创建一个实例
let _webConsole = null;

class WebConsole {
  // 注册插件
  static use(pluginCreator, options) {
    if (_webConsole) {
      console.warn("Plugin must be registered before creating WebConsole");
      return;
    }

    if (!isFunction(pluginCreator)) {
      console.warn("Invalid plugin:", pluginCreator);
      return;
    }
    const plugin = pluginCreator.call(null, WebConsole, options);
    pluginManager.addPlugin(plugin);
  }

  constructor(options) {
    if (_webConsole) {
      console.warn("WebConsole has been initialized, return previous instance: %O", _webConsole);
      return _webConsole;
    }

    _webConsole = this;
    this._isLoaded = false;
    this._load(this._processOptions(options));
  }

  _processOptions(options) {
    const defaultOptions = {
      panelVisible: false,
      activeTab: "console",
      entryStyle: "button"
    };

    const supportTab = Object.keys(PanelType).map(key => PanelType[key]);

    let activeTab = options.activeTab;
    if (supportTab.indexOf(activeTab) === -1 && !pluginManager.hasPlugin(activeTab)) {
      activeTab = defaultOptions.activeTab;
    }

    return {
      panelVisible: options.panelVisible || defaultOptions.panelVisible,
      entryStyle: options.entryStyle || defaultOptions.entryStyle,
      activeTab: activeTab
    };
  }

  _load(options = {}) {
    if (!this._isLoaded && (document.readyState === "interactive" || document.readyState === "complete")) {
      this._isLoaded = true;
      const root = document.createElement("div");
      (document.documentElement || document.body).appendChild(root);

      const vm = new Vue({
        el: root,
        render: h =>
          h(App, {
            props: {
              initPanelVisible: options.panelVisible,
              initActiveTab: options.activeTab,
              initEntryStyle: options.entryStyle
            }
          })
      });
    } else {
      document.addEventListener("readystatechange", this._load.bind(this, ...arguments));
    }
  }
}

WebConsole.Plugin = Plugin;

if (!window.WebConsole) {
  window.WebConsole = WebConsole;
  consoleHooks.install();
} else {
  console.error("Inject WebConsole into window failed");
}
export default WebConsole;
