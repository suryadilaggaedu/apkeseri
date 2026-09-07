/* =========================================================
   APKESERI — Service Worker
   PWA Foundation v1.0 — caching asas sahaja.
   Tidak cache video YouTube / kandungan luaran.
   ========================================================= */

"use strict";

// Naikkan nombor versi ini (cth: "apkeseri-v1.1") setiap kali
// index.html / style.css / script.js dikemas kini, supaya cache
// lama dibersihkan secara automatik oleh event "activate" di bawah.
// v2: ikon PNG dijana semula (opaque, square disahkan).
// v3: ikon rasmi APKESERI (daripada icon-apkeseri.zip) + logo Welcome
// screen ditambah — versi naik supaya klien sedia ada ambil aset
// baharu, bukan cache lama.
// v4: template sijil rasmi (template-sijil-apkeseri.png) ditambah
// untuk fungsi Sijil Penyertaan — versi naik supaya klien sedia ada
// ambil aset baharu. (jsPDF dimuatkan terus daripada CDN dalam
// index.html — bukan aset sama-asal, jadi tidak disenaraikan di sini,
// selaras dasar sedia ada: tidak cache kandungan luaran secara agresif.)
// v5: kemas kini UI/aliran Aktiviti 1-4 (12 emosi + kategori, skala
// Aktiviti 2, buang ikon tajuk), review/ulang aktiviti, pautan sijil
// Dashboard — index.html/style.css/script.js berubah, versi naik
// supaya klien sedia ada ambil versi baharu. Senarai aset (ikon,
// logo, templat sijil) tidak berubah.
// v6: baiki bug CSS label/nilai bertindih pada ringkasan Punca/Sebab
// Aktiviti 2 (.a2-summary__row) — style.css sahaja berubah.
// v7: templat baharu "Kad Penyertaan" (template-kad-penyertaan-
// apkeseri.png) menggantikan "Sijil Penyertaan" sebagai templat
// generator; istilah UI "sijil" ditukar kepada "kad". Templat lama
// dikekalkan sebagai fail projek (tidak dipadam) tetapi tidak lagi
// digunakan oleh generator.
var CACHE_NAME = "apkeseri-v7";

// Aset shell APKESERI sahaja — bukan video/YouTube.
var APP_SHELL_ASSETS = [
  "./index.html",
  "./style.css",
  "./script.js",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./assets/logo-apkeseri.png",
  "./assets/template-sijil-apkeseri.png",
  "./assets/template-kad-penyertaan-apkeseri.png"
];

self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll(APP_SHELL_ASSETS);
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys().then(function (cacheNames) {
      return Promise.all(
        cacheNames
          .filter(function (name) {
            return name.indexOf("apkeseri-") === 0 && name !== CACHE_NAME;
          })
          .map(function (name) {
            return caches.delete(name);
          })
      );
    })
  );
  self.clients.claim();
});

// Strategi: cache-first untuk aset shell sendiri, fallback ke rangkaian.
// Permintaan luar (cth: YouTube, Google Fonts) dibiarkan terus ke
// rangkaian seperti biasa — tidak dicache secara agresif.
self.addEventListener("fetch", function (event) {
  var requestUrl = new URL(event.request.url);

  // Hanya kendalikan permintaan GET dari asal yang sama (aset APKESERI).
  if (event.request.method !== "GET" || requestUrl.origin !== self.location.origin) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then(function (cachedResponse) {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(event.request)
        .then(function (networkResponse) {
          if (
            networkResponse &&
            networkResponse.status === 200 &&
            networkResponse.type === "basic"
          ) {
            var responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then(function (cache) {
              cache.put(event.request, responseClone);
            });
          }
          return networkResponse;
        })
        .catch(function () {
          // Offline dan tiada dalam cache — untuk navigasi laman,
          // cuba pulangkan shell index.html supaya app masih boleh dibuka.
          if (event.request.mode === "navigate") {
            return caches.match("./index.html");
          }
          return undefined;
        });
    })
  );
});
