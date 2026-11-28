/* 즐부 허브 서비스 워커 — 셸은 캐시, 문서는 네트워크 우선 */
const VERSION = "zlbu-hub-v1.2.1";

const SHELL = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./deed.js",
  "./deed.css",
  "./manifest.json",
  "./assets/hero-city.jpg",
  "./assets/profile.jpg",
  "./assets/book-gyeongmae.jpg",
  "./assets/book-1eok.jpg",
  "./assets/classu-thumb.jpg",
  "./assets/class101-thumb.jpg",
  "./assets/icon-192.png",
  "./assets/icon-512.png",
  "./assets/icon-maskable-512.png",
  "./assets/apple-touch-icon.png",
  "./assets/favicon-32.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(VERSION)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((key) => key !== VERSION).map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // 다른 사이트(유튜브 썸네일 등)는 그대로 네트워크로
  if (url.origin !== self.location.origin) return;

  // 문서: 네트워크 우선, 실패하면 캐시
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(VERSION).then((cache) => cache.put(req, copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(req).then((hit) => hit || caches.match("./index.html")))
    );
    return;
  }

  // 정적 자산: 캐시 우선
  event.respondWith(
    caches.match(req).then((hit) => {
      if (hit) return hit;
      return fetch(req).then((res) => {
        if (res && res.status === 200 && res.type === "basic") {
          const copy = res.clone();
          caches.open(VERSION).then((cache) => cache.put(req, copy)).catch(() => {});
        }
        return res;
      });
    })
  );
});
