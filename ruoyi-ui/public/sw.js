/*
 * APMS Service Worker（极简）
 *
 * 唯一目的：满足 Chrome/Edge Android 把站点识别为「可安装 PWA」的条件
 * （需存在注册成功且含 fetch 监听的 Service Worker），使业务站（aoti）
 * 从主屏幕图标启动时按 manifest 的 display:fullscreen 全屏运行。
 *
 * 重要：本 SW **不做任何缓存与请求拦截**——fetch 事件不调用 respondWith，
 * 浏览器走默认网络栈，登录配置/静态资源的更新策略与现状完全一致，
 * 不会出现 SW 缓存导致配置不刷新的问题。
 */
self.addEventListener('install', function () {
  self.skipWaiting()
})

self.addEventListener('activate', function (event) {
  event.waitUntil(self.clients.claim())
})

// 空监听：仅用于声明 fetch 处理能力，所有请求默认直通网络
self.addEventListener('fetch', function () {})
