# PWA Miras Taksim ve Fiili Kullanım Yönetimi

20+ parsel ve çok paydaşlı (100+ mirasçı) miras intikalleri için geliştirilmiş, Google Hibrit harita destekli, kesirli hisse matematiğine (`fraction.js`) dayalı, çift modlu (Tam Müstakil ve Kardeş Ortaklı) taksim optimizasyonu, noter ön mutabakat metinleri ve parsel içi alt KML fiili kullanım krokisi üreten masaüstü öncelikli PWA uygulaması.

---

## GitHub Pages Üzerinden Yayınlama (Build & Deploy)

Bu depo, GitHub Actions kullanarak projenizi GitHub Pages üzerinde otomatik olarak derleyip yayınlayacak şekilde yapılandırılmıştır (`.github/workflows/deploy.yml`).

### Yayınlama Adımları:

1. **GitHub Deponuzu Açın**:
   - Bu projeyi GitHub hesabınıza yükleyin (`git push origin main` veya `master`).

2. **GitHub Pages Ayarını Yapın**:
   - GitHub deposunda üst menüden **Settings** (Ayarlar) sekmesine gidin.
   - Sol menüden **Pages** seçeneğine tıklayın.
   - **Build and deployment** başlığı altındaki **Source** açılır menüsünden:
     - `Deploy from a branch` yerine **`GitHub Actions`** seçeneğini seçin.

3. **Otomatik Yayınlanma**:
   - `main` veya `master` dalına her kod gönderdiğinizde (veya Actions sekmesinden *Run workflow* ile tetiklediğinizde), GitHub Actions otomatik olarak:
     - Bağımlılıkları kurar (`npm install`),
     - Projeyi derler (`npm run build`),
     - Çıktıyı `https://<kullanici-adiniz>.github.io/<depo-adiniz>/` adresine yayınlar.

---

## Yerel Geliştirme (Local Development)

```bash
# 1. Bağımlılıkları yükleyin
npm install

# 2. Geliştirme sunucusunu başlatın
npm run dev

# 3. Canlı yayın için derleme yapın
npm run build
```

---

## Temel Özellikler

- **Google Hibrit, Esri Uydu ve OSM Harita Katmanları**: Kadastro parsellerini uydu ve yol isimleriyle net görüntüleme.
- **Parsel İçi Alt KML (Fiili Kullanım Krokisi)**: Müstakil ifrazı yapılamayan parsellerde her hissedarın kullanacağı somut alanları belirleme ve sözleşmeye bağlama.
- **Kesirli Hisse Matematiği (`fraction.js`)**: 1/72, 3/10 gibi hisselerde sıfır yuvarlama hatası.
- **Çift Modlu Taksim Optimizasyonu**: Tam Müstakil ve Kardeş Ortaklı senaryoları karşılaştırma.
- **Sıfır Toplamlı Nakit İvaz Matrisi**: Borçlu ve alacaklıların mahsuplaşma planı.
- **Noter Taslakları**: Şarta bağlı vekaletname, Nihai Ön Mutabakat Zaptı ve Fiili Kullanım Sözleşmesi (resmi ibaresi içermez).
- **Offline-First & .ZIP Arşivleme**: Tüm verileri yerel IndexedDB'de tutma ve tek tıkla .ZIP olarak yedekleme/geri yükleme.
