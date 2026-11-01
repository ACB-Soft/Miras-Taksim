# PWA Tabanlı Miras Taksim ve Fiili Kullanım Yönetimi Uygulaması

Çok kuşaklı ve çok paydaşlı (100+ mirasçıya kadar ölçeklenebilir) miras intikallerinde, 20 ve üzeri parselin adil, şeffaf, müstakil tapuya dönüştürülebilir veya parsel içi fiili kullanım krokileriyle noter tasdikli sözleşmelere bağlanabilir şekilde taksim edilmesini sağlayan; offline-first, masaüstü öncelikli PWA uygulaması.

---

### User Review & Critical Decisions

> [!IMPORTANT]
> Kullanıcı geri bildirimleri ve teyit edilen tercihler doğrultusunda güncellenen mimari kararlar:

- **Başlangıç Durumu**: Uygulama tamamen boş, sıfırdan veri girişiyle açılacaktır (demo veri yükleme butonu kaldırılmıştır).
- **Mirasçı Kapasitesi**: Mirasçı sayısında hiçbir üst sınır bulunmayacaktır (10, 50, 100+ mirasçı ve kademeli soy kütükleri esnek şekilde eklenebilir, aranabilir ve filtrelenebilir).
- **Harita Altlıkları**: Leaflet harita motoruna **Google Hibrit (Uydu + Yol/Yer İsimleri)**, **Esri Uydu Görüntüsü** ve **OpenStreetMap Standart Sokak Haritası** katmanları entegre edilecek; kullanıcı tek tıkla katmanlar arası geçiş yapabilecektir.
- **Dosya Yükleme Yöntemi**: Sürükle-bırak yerine temiz, standart yerel dosya seçici (`Dosyadan KML Seç` / `Dosyadan ZIP Seç`) butonları kullanılacaktır.
- **Parsel İçi Alt KML & Fiili Kullanım Sınırları (Rızai Taksim)**:
  - Müstakil tapuya ayrılamayan veya ortak kalınması gereken parseller için parsel detayında "Alt KML Yükle" seçeneği sunulacaktır.
  - Yüklenen KML içerisindeki her bir kullanım poligonu harita üzerinde ayrı sınırlarla gösterilecek, kullanıcı haritaya tıklayarak veya yanındaki listeden her alt kullanım alanını bir mirasçıya tahsis edebilecektir.
  - Bu alt kullanım alanlarının m² hesapları çıkarılarak noter için **"Fiili Kullanım ve Rızai Taksim Sözleşmesi"** ile **"Koordinatlı Fiili Kullanım Krokisi"** taslağı üretilecektir.
- **Taksim Optimizasyon Stratejisi**: Hem **Tam Müstakil Taksim** hem de **Kardeş Ortaklı Taksim** senaryoları tek tıkla hesaplanıp karşılaştırılabilecek; kuruşu kuruşuna sıfır toplamlı nakit denkleştirme (ivaz) matrisi çıkarılacaktır.

---

## 1. Overview & Core Concept

- **Ne İşe Yarar**:
  1. KML dosyalarını yükleyerek ana parselleri haritada görüntüleme, m², vasıf ve rayiç değer tanımlama.
  2. Müstakil ayrılamayan parseller için parsel içine alt KML kullanım sınırları yükleyerek her hissedarın kullanacağı somut sınırları belirleme.
  3. Sınırsız sayıda mirasçı için kademeli veraset kütüğü (`fraction.js` ile 1/72, 3/10 vb. sıfır yuvarlama hatası) ve hak ediş hesabı.
  4. Yapay zeka ve bin-packing optimizasyonu ile parselleri en adil biçimde paylaştırma ve ivaz (denkleştirme bedeli) tablosunu oluşturma.
  5. Şarta bağlı noter vekaletnamesi, Nihai Taksim Ön Mutabakat Zaptı ve Parsel İçi Fiili Kullanım Rızai Taksim Sözleşmesi üretme.
  6. Tüm çalışmayı yerel IndexedDB'de gizli tutma ve tek tıkla `.zip` olarak bilgisayara indirip geri yükleme.
- **Hedef Kitle**: Mirasçılar, aile temsilcileri, avukatlar, gayrimenkul değerleme uzmanları ve harita/kadastro mühendisleri.

---

## 2. User Experience & Visual Design

### A. Layout Structure (Desktop-First GIS & Legal Workspace)
- **Ekran Düzeni**: 1440px desktop baseline; sol tarafta 260px genişliğinde daraltılabilir profesyonel çalışma paneli, üstte tek satırlık Top Bar (Proje Adı, Çevrimdışı Durum, PWA Yükle, ZIP Dışa/İçe Aktar), merkezde modül ekranı.
- **Modüller**:
  1. **Parsel & Harita Yönetimi**: Dosyadan KML yükleme, Google Hibrit / Esri Uydu / OSM haritası, 20+ parsel listesi, m² ve rayiç bedel düzenleyici, parsel detayında **"Alt KML (Fiili Kullanım) Yükle"** ve haritadan malik eşleştirme paneli.
  2. **Veraset & Malik Kütüğü**: Sınırsız mirasçı ekleme/düzenleme, kök muris kollarını tanımlama, kesirli hisse matrisi (`fraction.js`), dinamik arama, filtreleme ve toplam portföy hak edişi (TL / m²).
  3. **Taksim & Optimizasyon**: Müstakil ve Kardeş Ortaklı senaryo simülasyonları, bin-packing algoritması, Gemini AI destekli adalet değerlendirmesi ve parsel tahsis tablosu.
  4. **Nakit İvaz (Denkleştirme) Matrisi**: Kimin kime ne kadar nakit denkleştirme bedeli ödeyeceğinin kuruşu kuruşuna sıfır toplamlı tablosu.
  5. **Noter & Hukuki Protokoller**:
     - *Şarta Bağlı Özel Noter Vekaletnamesi* (yetki aşımını engelleyen koruma hükümleriyle).
     - *Nihai Taksim Ön Mutabakat Zaptı* (tüm malikler ve parsel tahsis cetveli).
     - *Fiili Taksim ve Kullanım Sözleşmesi* (parsel içi alt KML poligonları, m²'leri ve hak sahibi malik eşleşmeleriyle noter onayına hazır kroki eki).
  6. **Arşiv & Yedekleme (.ZIP)**: Dosyadan ZIP yükleme ve tek tıkla tam proje paketini indirme.

### B. Görsel Kimlik & Tema
- **Aesthetic Direction**: Kurumsal, güven veren, hukuk ve tapu/harita disiplinine uygun analitik tasarım.
- **Renk Paleti**:
  - Arka Plan: Açık gri ve temiz beyaz (`#F8FAFC` / `#FFFFFF`), isteğe bağlı koyu mod (`#0F172A`).
  - Birincil Vurgu: Tapu/kadastro kobalt laciverti (`#1E3A8A` / `#2563EB`).
  - Harita Poligon Renkleri: Parsel sınırları için net kadastro çizgileri, alt kullanım alanları için mirasçı bazlı ayırt edici renk kodları.
- **Tipografi**:
  - Başlıklar ve Kontroller: `Plus Jakarta Sans`
  - Sayısal Veriler, Hisseler ve Matrisler: `JetBrains Mono` / `tabular-nums` (kesir ve para birimi dikey hizalaması).
- **Anti-Slop Restraint**: Süslü hap etiketleri yok; sade tipografik ayraçlar (`·`), net tek satır butonlar ve tabular tablolar.

---

## 3. Key Product Decisions & Trade-Offs

| Konu | Seçilen Mimari | Tercih Nedeni | Değerlendirilen Alternatifler |
| :--- | :--- | :--- | :--- |
| **Harita Katmanları** | Leaflet + Google Hibrit (`lyrs=y`), Esri World Imagery, OpenStreetMap | Kullanıcının Türkiye'deki tarla, kadastro sınırları ve yer isimlerini net ayırt edebilmesi için Google Hibrit uydu katmanı en yüksek netliği sağlar. | Sadece OSM (arazi sınırları uydu olmadan net seçilemez). |
| **Parsel İçi Fiili Taksim** | Parsel bazlı Alt-KML poligon yükleme + Mirasçı Eşleme | Müstakil parselasyon yapılamayan durumlarda Türk Medeni Kanunu md. 698/699 uyarınca noterde rızai fiili kullanım taksimi tescil ettirilebilir. Haritada her kullanım alanının sahibini seçmek somut hukuki güvence sağlar. | Sadece metin bazlı hisse açıklaması (kroki ve koordinatsız noter onayı geçersiz kalabilir). |
| **Mirasçı Ölçeklenebilirliği** | Sınırsız Dinamik Dizi + Sayfalama/Arama + Sanal Ağaç Yapısı | 100+ mirasçı olduğunda bile performans kaybı yaşanmaz, arama ve kök filtreleme ile kolay yönetim sağlanır. | Sabit 9 kişilik matris (esneklik olmadığı için reddedildi). |
| **Dosya Erişimi** | Standart HTML5 `<input type="file">` | Masaüstü tarayıcılarda doğrudan dosya seçimi kesin, güvenilir ve kullanıcı tercihine tam uygundur. | Yalnızca sürükle-bırak (kullanıcı talebiyle kaldırıldı). |
| **Hassas Matematik** | `fraction.js` (Rasyonel Kesir) | 1/72, 3/10, 11/144 gibi hisselerde 0.0001 kuruş bile yuvarlama hatası yapılmaz, pay/payda tam korunur. | Float sayılar (yuvarlama hatası nedeniyle elendi). |

---

## 4. Technical Architecture & Data Strategy

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       DESKTOP PWA SHELL (React + Vite)                      │
│                                                                             │
│  ┌──────────────────────┐  ┌──────────────────────────────────────────────┐ │
│  │   SIDEBAR NAV        │  │                TOP BAR                       │ │
│  │  · Parseller         │  │  Proje: Miras Taksim Sistemi  [PWA Yükle]    │ │
│  │  · Malikler (100+)   │  │  [Dosyadan ZIP Yükle] [Projeyi .ZIP İndir]   │ │
│  │  · Fiili Taksim      │  └──────────────────────────────────────────────┘ │
│  │  · Taksim & AI       │  ┌──────────────────────────────────────────────┐ │
│  │  · İvaz Matrisi      │  │             ACTIVE WORKSPACE VIEW            │ │
│  │  · Noter & Sözleşme  │  │  - Leaflet Haritası (Google Hibrit/Esri/OSM) │ │
│  │  · Arşiv & Ayarlar   │  │  - Parsel & Alt KML Poligon Katmanları       │ │
│  └──────────────────────┘  │  - Malik Atama & Fiili Kullanım Krokisi      │ │
│                            │  - İvaz ve Noter Protokol Taslakları         │ │
│                            └──────────────────────────────────────────────┘ │
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                        CORE ENGINES & STORES                          │  │
│  │  · fraction.js (Hassas Kesir & Net Portföy Değer Hak Ediş Motoru)      │  │
│  │  · Sub-Parcel KML Engine (Alt Kullanım Poligonları & Malik Eşleme)    │  │
│  │  · Taksim Optimizasyon Motoru (Bin-Packing / Kardeş Birleştirme / İvaz)│  │
│  │  · KML Parser (@tmcw/togeojson + Dosya Seçici)                        │  │
│  │  · IndexedDB Persistence Engine (Yerel Gizli Depolama)                │  │
│  │  · JSZip Arşiv Motoru (Proje Verisi + KML'ler + Alt KML'ler + Noter)  │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ POST /api/gemini/optimize
                                       ▼
                 ┌───────────────────────────────────────────┐
                 │         EXPRESS BACKEND PROXY             │
                 │  - @google/genai (gemini-3.8-flash)       │
                 │  - Taksim gerekçelendirme & adalet analizi│
                 └───────────────────────────────────────────┘
```

### Temel Veri Modelleri
1. **Parcel**:
   - `id`: string
   - `ada`, `parselNo`, `mevkii`, `alanM2`, `nitelik`, `birimFiyatTL`, `toplamDegerTL`
   - `geoJson`: GeoJSON Polygon/MultiPolygon
   - `kmlFileName`: string
   - `subUsageAreas`: Array<{ `id`, `name`, `alanM2`, `assignedHeirId`, `geoJson`, `color` }> (Parsel içi alt KML poligonları)
2. **Heir (Malik)**:
   - `id`: string
   - `adSoyad`, `tcKimlik`, `kusak` (1, 2, 3, 4, ...), `kokMurisKolId`, `hisseOrani` (Fraction: `"1/12"`), `telefon`, `vekilMi`
3. **PartitionScenario**:
   - `mode`: `"pure_independent"` vs. `"sibling_consolidation"`
   - `assignments`: Record<MalikId, ParcelId[]>
   - `equalizationMatrix`: Sıfır toplamlı net borç/alacak tablosu
   - `aiEvaluation`: Gemini 3.8 Flash gerekçelendirme raporu
4. **NotaryDocuments**:
   - *Şarta Bağlı Özel Yetkili Noter Vekaletnamesi*
   - *Nihai Taksim Ön Mutabakat Zaptı*
   - *Parsel İçi Fiili Taksim ve Kullanım Sözleşmesi* (kroki koordinat dökümlü)

---

## 5. Implementation Phases & Milestones

1. **Temel Altyapı & PWA**:
   - Paketlerin kurulumu: `leaflet`, `@types/leaflet`, `@tmcw/togeojson`, `fraction.js`, `jszip`, `file-saver`, `@types/file-saver`.
   - `server.ts` Express backend ve `@google/genai` (`gemini-3.8-flash`) proxy rotası.
   - PWA yapılandırması: `manifest.json`, servis işçisi, `usePWAInstall`, `PWAInstallButton`, `public/icon.svg`.
2. **KML & Harita Motoru (Google Hibrit + Alt KML Fiili Kullanım)**:
   - Dosyadan KML seçimiyle 20+ parselin içeri aktarılması.
   - Google Hibrit (`https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}`), Esri Satellite ve OSM katman geçişleri.
   - Her parsel için detay modalında "Alt KML Yükle" butonu; parsel içindeki bölünmüş poligonların tespiti, alan hesaplaması ve haritada/listede tıklayarak malik atanması.
3. **Veraset & Kesir Matrisi (`fraction.js`) (100+ Mirasçı Desteği)**:
   - Sınırsız mirasçı ekleme/düzenleme, kök muris kollarının tanımlanması.
   - `fraction.js` ile pay/payda doğrulama (toplamın 1/1 kontrolü).
   - Portföy toplam değerinin mirasçılara kuruş hassasiyetinde yansıtılması.
4. **Çift Modlu Taksim Optimizasyonu & Sıfır Toplamlı İvaz Matrisi**:
   - Deterministik Bin-Packing: Tam Müstakil ve Kardeş Ortaklı modlar.
   - Net sıfır toplamlı nakit denkleştirme borç/alacak matrisi.
   - Gemini 3.8 Flash ile taksim gerekçelendirme raporu oluşturulması.
5. **Noter ve Fiili Taksim Sözleşmesi Üreticisi**:
   - Şarta bağlı noter vekaletnamesi.
   - Nihai Taksim Ön Mutabakat Zaptı.
   - Fiili Kullanım ve Rızai Taksim Sözleşmesi (alt KML kroki ve parsel kullanım cetveli ile birlikte).
   - Yazdırılabilir resmi evrak formatı.
6. **ZIP Arşivleme & Yerel Kalıcılık**:
   - Dosyadan ZIP yükleme ve tek tıkla tam proje .zip indirme (`proje.json`, ana KML'ler, alt KML'ler, noter belgeleri).
   - Tarayıcı içi IndexedDB yerel saklama.
7. **Derleme & Doğrulama**:
   - `compile_applet` ile tip ve derleme testleri.
