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
// v8: baiki bug video YouTube Aktiviti 3 terus main di latar
// belakang selepas murid tinggalkan aktiviti/langkah tersebut —
// script.js sahaja berubah (tiada aset baharu).
// v9: buang butang "ULANG AKTIVITI" dan "TAK, KEMBALI" yang tidak
// berfungsi pada skrin Semakan Hasil — index.html/script.js sahaja
// berubah (tiada aset baharu, tiada logik lain diubah).
// v10: Phase 4 — multi-user ringan (APKESERI_USERS/APKESERI_
// ACTIVE_USER), modal "Tukar Pengguna?", pilih pengguna lama pada
// onboarding — index.html/style.css/script.js berubah, tiada aset
// baharu, tiada perubahan pada templat/manifest.
// v11: Fasa 5C — skrin counter global (Supabase get_completion_count)
// untuk first-time visitor sebelum intro sedia ada — index.html/
// style.css/script.js berubah. Skrip CDN Supabase JS v2 (asal luar,
// bukan sama-asal) SENGAJA tidak ditambah ke senarai cache di bawah,
// selaras dasar sedia ada (spt. jsPDF) — tidak cache kandungan luaran
// secara agresif; ia dimuatkan terus daripada CDN setiap kali online.
// v12: Fasa 5D — pendaftaran completion global (register_completion)
// selepas Aktiviti 4 benar-benar selesai, dengan pending/retry
// offline — script.js sahaja berubah, tiada aset baharu.
var CACHE_NAME = "apkeseri-v12";

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
