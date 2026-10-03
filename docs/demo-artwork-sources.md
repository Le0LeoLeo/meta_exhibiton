# 示範展名作圖像來源

核對日期：2026-09-05。首頁與示範展共用 `createDemoScene`，以下圖像以本機靜態檔案提供，不依賴訪客連線到博物館。

三筆 The Met Collection API 記錄均有 `isPublicDomain: true`。依 [The Met Open Access](https://www.metmuseum.org/hubs/open-access)，公有領域圖像與基本館藏資料依 CC0 開放使用。作品名稱、作者與年份採館藏基本資料；觀看提示為本專案撰寫。此虛擬示範不表示博物館合作或背書。

| 檔案 | 作品／作者／年代 | 館藏來源 | 官方圖像 |
| --- | --- | --- | --- |
| `public/demo/met-45434.jpg` | 神奈川沖浪裏／葛飾北齋／約 1830–32 | [The Met 45434](https://www.metmuseum.org/art/collection/search/45434) | [DP130155.jpg](https://images.metmuseum.org/CRDImages/as/web-large/DP130155.jpg) |
| `public/demo/met-436535.jpg` | 有柏樹的麥田／Vincent van Gogh／1889 | [The Met 436535](https://www.metmuseum.org/art/collection/search/436535) | [DP-42549-001.jpg](https://images.metmuseum.org/CRDImages/ep/web-large/DP-42549-001.jpg) |
| `public/demo/met-437881.jpg` | 持水壺的年輕女子／Johannes Vermeer／約 1662 | [The Met 437881](https://www.metmuseum.org/art/collection/search/437881) | [DP353257.jpg](https://images.metmuseum.org/CRDImages/ep/web-large/DP353257.jpg) |

原圖未重繪、未裁切。3D 畫框按各檔案寬高比例顯示；2D 大圖使用 contain。館藏 API 記錄可由 `https://collectionapi.metmuseum.org/public/collection/v1/objects/{id}` 重新核對。三張圖片共 470,632 bytes。

## 2026-09-10 新增主題展

以下四件已重新核對 Met API：`isPublicDomain: true`，本地保存原圖、按原始比例顯示。每場三件，部分作品跨展策展，共七件獨立作品。

- `public/demo/met-436965.jpg` — The Monet Family in Their Garden at Argenteuil / Edouard Manet / 1874; [館藏](https://www.metmuseum.org/art/collection/search/436965), [圖像](https://images.metmuseum.org/CRDImages/ep/web-large/DP-25465-001.jpg)。
- `public/demo/met-436534.jpg` — Roses / Vincent van Gogh / 1890; [館藏](https://www.metmuseum.org/art/collection/search/436534), [圖像](https://images.metmuseum.org/CRDImages/ep/web-large/DP346475.jpg)。
- `public/demo/met-56213.jpg` — Fuji from the Katakura Tea Fields in Suruga (Sunshū Katakura chaen no Fuji), from the series Thirty-six Views of Mount Fuji (Fugaku sanjūrokkei) / Katsushika Hokusai / ca. 1830–32; [館藏](https://www.metmuseum.org/art/collection/search/56213), [圖像](https://images.metmuseum.org/CRDImages/as/web-large/DP141048.jpg)。
- `public/demo/met-55739.jpg` — Noboto at Shimōsa (Shimōsa Noboto), from the series One Thousand Pictures of the Sea (Chie no umi) / Katsushika Hokusai / 1832–33; [館藏](https://www.metmuseum.org/art/collection/search/55739), [圖像](https://images.metmuseum.org/CRDImages/as/web-large/DP140974.jpg)。

## 2026-09-10 每場擴充至 11 件

新增以下 24 件；每筆 Met API 已驗證 isPublicDomain=true 並保存原始官方圖片。三場各 11 件，合共 31 件不同作品（兩件跨展展出）。觀看提示為本專案原創。

- `public/demo/met-436529.jpg` — L'Arlésienne: Madame Joseph-Michel Ginoux (Marie Julien, 1848–1911) / Vincent van Gogh / 1888–89; [館藏](https://www.metmuseum.org/art/collection/search/436529), [圖像](https://images.metmuseum.org/CRDImages/ep/web-large/DT1396.jpg)；496 × 624。
- `public/demo/met-436532.jpg` — Self-Portrait with a Straw Hat (obverse: The Potato Peeler) / Vincent van Gogh / 1887; [館藏](https://www.metmuseum.org/art/collection/search/436532), [圖像](https://images.metmuseum.org/CRDImages/ep/web-large/DT1502_cropped2.jpg)；502 × 625。
- `public/demo/met-436533.jpg` — Shoes / Vincent van Gogh / 1888; [館藏](https://www.metmuseum.org/art/collection/search/436533), [圖像](https://images.metmuseum.org/CRDImages/ep/web-large/DT1947.jpg)；599 × 501。
- `public/demo/met-437153.jpg` — Oedipus and the Sphinx / Gustave Moreau / 1864; [館藏](https://www.metmuseum.org/art/collection/search/437153), [圖像](https://images.metmuseum.org/CRDImages/ep/web-large/DP-14201-023.jpg)；323 × 624。
- `public/demo/met-437158.jpg` — Portrait of a Man / Moretto da Brescia (Alessandro Bonvicino) / ca. 1520–25; [館藏](https://www.metmuseum.org/art/collection/search/437158), [圖像](https://images.metmuseum.org/CRDImages/ep/web-large/DP-25741-001.jpg)；590 × 625。
- `public/demo/met-437174.jpg` — A Knight of Alcántara or Calatrava / Bartolomé Estebán Murillo / ca. 1650–55; [館藏](https://www.metmuseum.org/art/collection/search/437174), [圖像](https://images.metmuseum.org/CRDImages/ep/web-large/DP223490.jpg)；365 × 624。
- `public/demo/met-437182.jpg` — Portrait of a Woman / Jean Marc Nattier / 1753; [館藏](https://www.metmuseum.org/art/collection/search/437182), [圖像](https://images.metmuseum.org/CRDImages/ep/web-large/DT8872.jpg)；504 × 624。
- `public/demo/met-437327.jpg` — The Companions of Rinaldo / Nicolas Poussin / ca. 1633; [館藏](https://www.metmuseum.org/art/collection/search/437327), [圖像](https://images.metmuseum.org/CRDImages/ep/web-large/DT5182.jpg)；539 × 625。
- `public/demo/met-436526.jpg` — First Steps, after Millet / Vincent van Gogh / 1890; [館藏](https://www.metmuseum.org/art/collection/search/436526), [圖像](https://images.metmuseum.org/CRDImages/ep/web-large/DP124808.jpg)；599 × 475。
- `public/demo/met-436530.jpg` — Oleanders / Vincent van Gogh / 1888; [館藏](https://www.metmuseum.org/art/collection/search/436530), [圖像](https://images.metmuseum.org/CRDImages/ep/web-large/DT1494.jpg)；599 × 492。
- `public/demo/met-436536.jpg` — Women Picking Olives / Vincent van Gogh / 1889; [館藏](https://www.metmuseum.org/art/collection/search/436536), [圖像](https://images.metmuseum.org/CRDImages/ep/web-large/DP-17161-001.jpg)；599 × 484。
- `public/demo/met-436175.jpg` — Basket of Flowers / Eugène Delacroix / 1848–49; [館藏](https://www.metmuseum.org/art/collection/search/436175), [圖像](https://images.metmuseum.org/CRDImages/ep/web-large/DP-14347-001.jpg)；600 × 453。
- `public/demo/met-436121.jpg` — A Woman Seated beside a Vase of Flowers (Madame Paul Valpinçon?) / Edgar Degas / 1865; [館藏](https://www.metmuseum.org/art/collection/search/436121), [圖像](https://images.metmuseum.org/CRDImages/ep/web-large/DP-25460-001.jpg)；600 × 488。
- `public/demo/met-437382.jpg` — Vase of Flowers (Pink Background) / Odilon Redon / ca. 1906; [館藏](https://www.metmuseum.org/art/collection/search/437382), [圖像](https://images.metmuseum.org/CRDImages/ep/web-large/DT2159.jpg)；465 × 624。
- `public/demo/met-436524.jpg` — Sunflowers / Vincent van Gogh / 1887; [館藏](https://www.metmuseum.org/art/collection/search/436524), [圖像](https://images.metmuseum.org/CRDImages/ep/web-large/DP-41223-001.jpg)；599 × 423。
- `public/demo/met-436528.jpg` — Irises / Vincent van Gogh / 1890; [館藏](https://www.metmuseum.org/art/collection/search/436528), [圖像](https://images.metmuseum.org/CRDImages/ep/web-large/DP346474.jpg)；599 × 475。
- `public/demo/met-55236.jpg` — Fuji Seen from Kanaya on the Tōkaidō (Tōkaidō Kanaya no Fuji), from the series Thirty-six Views of Mount Fuji (Fugaku sanjūrokkei) / Katsushika Hokusai / ca. 1830–32; [館藏](https://www.metmuseum.org/art/collection/search/55236), [圖像](https://images.metmuseum.org/CRDImages/as/web-large/DP141002.jpg)；600 × 412。
- `public/demo/met-56686.jpg` — Fuji—The Tama River, Musashi Province, from the series Thirty-six Views of Mount Fuji (Fugaku sanjūrokkei) / Katsushika Hokusai / ca. 1830–32; [館藏](https://www.metmuseum.org/art/collection/search/56686), [圖像](https://images.metmuseum.org/CRDImages/as/web-large/DP140975.jpg)；600 × 415。
- `public/demo/met-56229.jpg` — Storm below Mount Fuji (Sanka no haku u), from the series Thirty-six Views of Mount Fuji (Fugaku sanjūrokkei) / Katsushika Hokusai / ca. 1830–32; [館藏](https://www.metmuseum.org/art/collection/search/56229), [圖像](https://images.metmuseum.org/CRDImages/as/web-large/DP141054.jpg)；599 × 409。
- `public/demo/met-55223.jpg` — Fuji from Gotenyama on the Tōkaidō at Shinagawa (Tōkaidō Shinagawa Gotenyama no Fuji), from the series Thirty-six Views of Mount Fuji (Fugaku sanjūrokkei) / Katsushika Hokusai / ca. 1830–32; [館藏](https://www.metmuseum.org/art/collection/search/55223), [圖像](https://images.metmuseum.org/CRDImages/as/web-large/DP140996.jpg)；599 × 408。
- `public/demo/met-56216.jpg` — Noboto Bay (Noboto no ura), from the series Thirty-six Views of Mount Fuji (Fugaku sanjūrokkei) / Katsushika Hokusai / ca. 1830–32; [館藏](https://www.metmuseum.org/art/collection/search/56216), [圖像](https://images.metmuseum.org/CRDImages/as/web-large/DP141051.jpg)；599 × 410。
- `public/demo/met-56214.jpg` — Fujimigahara in Owari Province (Bishū Fujimigahara), from the series Thirty-six Views of Mount Fuji (Fugaku sanjūrokkei) / Katsushika Hokusai / ca. 1830–32; [館藏](https://www.metmuseum.org/art/collection/search/56214), [圖像](https://images.metmuseum.org/CRDImages/as/web-large/DP141049.jpg)；599 × 409。
- `public/demo/met-56217.jpg` — View from the Other Side of Fuji from the Minobu River (Minobugawa ura Fuji), from the series Thirty-six Views of Mount Fuji (Fugaku sanjūrokkei) / Katsushika Hokusai / ca. 1830–32; [館藏](https://www.metmuseum.org/art/collection/search/56217), [圖像](https://images.metmuseum.org/CRDImages/as/web-large/DP141052.jpg)；599 × 412。
- `public/demo/met-56240.jpg` — Lake Suwa in Shinano Province (Shinshū Suwako), from the series Thirty-six Views of Mount Fuji (Fugaku sanjūrokkei) / Katsushika Hokusai / ca. 1830–32; [館藏](https://www.metmuseum.org/art/collection/search/56240), [圖像](https://images.metmuseum.org/CRDImages/as/web-large/DP141058.jpg)；599 × 414。
