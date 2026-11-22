import express from 'express';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import path from 'path';

dotenv.config();

const app = express();
app.use(express.json({ limit: '50mb' }));

// Server-side Gemini client with aistudio-build telemetry header
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

// AI Optimization & Legal Justification Endpoint
app.post('/api/gemini/optimize', async (req, res) => {
  try {
    const { parcels, heirs, scenarioMode, assignments, equalizationData } = req.body;

    if (!parcels || !heirs || parcels.length === 0 || heirs.length === 0) {
      return res.status(400).json({
        error: 'Optimizasyon için en az 1 parsel ve 1 mirasçı verisi gereklidir.',
      });
    }

    const prompt = `
Sen Türk Miras Hukuku, Gayrimenkul Değerleme ve Kadastro Taksimi konularında uzman bir kıdemli hukuk ve finans danışmanısın.
Aşağıda miras intikaline konu taşınmazlar, mirasçılar ve yapılan matematiksel taksim (bin-packing) sonuçları yer almaktadır.

UYARI VE KESİN KURAL: Hiçbir çıktında, analizinde veya başlığında "resmi" sözcüğünü KESİNLİKLE KULLANMA. Mirasçılar arasında özel hukuk sözleşmesi, mutabakat metni ve ön protokol esas alınmalıdır.

=== VERİLER ===
Taksim Modu: ${scenarioMode === 'pure_independent' ? 'Tam Müstakil Taksim (Her parsele tek malik)' : 'Kardeş Ortaklı Taksim (Aynı koldaki kardeşler gerekirse ortak)'}
Toplam Parsel Sayısı: ${parcels.length}
Toplam Mirasçı Sayısı: ${heirs.length}

Parseller Özeti:
${parcels.slice(0, 30).map((p: any) => `- Ada/Parsel: ${p.ada}/${p.parselNo}, Alan: ${p.alanM2} m², Nitelik: ${p.nitelik || 'Belirtilmemiş'}, Değer: ${Number(p.toplamDegerTL || 0).toLocaleString('tr-TR')} TL`).join('\n')}

Mirasçılar ve Hak Edişleri:
${heirs.slice(0, 30).map((h: any) => `- ${h.adSoyad} (${h.kusak}. Kuşak, Kök Kol: ${h.kokMurisKolId || 'Kök'}), Hisse Oranı: ${h.hisseOrani}, Hak Edilen: ${Number(h.hakEdilenTL || 0).toLocaleString('tr-TR')} TL`).join('\n')}

Dağıtım ve İvaz (Denkleştirme) Özeti:
${equalizationData ? JSON.stringify(equalizationData, null, 2) : 'Hesaplanan dağılım'}

Lütfen aşağıdaki başlıklar altında Markdown formatında Türkçe detaylı, yapıcı ve tarafsız bir Taksim Değerlendirme Raporu oluştur:
1. Dağıtım Adaleti ve Hak Dengesi Analizi (Mirasçıların hak edişleri ile aldıkları taşınmazların orantısı)
2. Kök Mirasçılar (Kardeş Kolları) Bazında Coğrafi ve Mülkiyet Bütünlüğü (Aynı koldan gelenlerin parsel yakınlıkları ve paydaşlık mantığı)
3. İvaz (Nakit Denkleştirme) Süreci ve Ödeme Güvenliği Önerileri (Borçlu ve alacaklıların mahsuplaşma ve ödeme takvimi)
4. Aile İçi Uzlaşma ve Noter Süreci Tavsiyeleri (Şarta bağlı vekalet ve ön mutabakat zaptının imza aşamaları)
5. Varsa Çekişme Riski Taşıyan Noktalar ve Çözüm Yolları

Rapor profesyonel, güven verici, uzlaştırıcı ve analitik bir dille hazırlanmalıdır.
`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        systemInstruction: 'Tarafsız, uzman gayrimenkul ve miras hukuku danışmanı olarak hareket et. Asla "resmi" kelimesini kullanma. Tamamen Türkçe ve anlaşılır yaz.',
      },
    });

    const reportText = response.text || 'Taksim analizi başarıyla tamamlandı.';
    return res.json({ report: reportText });
  } catch (error: any) {
    console.error('Gemini Optimization Error:', error);
    return res.status(500).json({
      error: error.message || 'Yapay zeka optimizasyon raporu oluşturulurken bir hata oluştu.',
    });
  }
});

// Fixed allowlisted TKGM MEGSIS CBS API base URL (never overridden by client)
const TKGM_API_BASE = 'https://cbsapi.tkgm.gov.tr/megsiswebapi.v3.1/api';

async function fetchTkgmUpstream(endpointPath: string): Promise<{ ok: boolean; status: number; data: any }> {
  const targetUrl = `${TKGM_API_BASE}${endpointPath}`;
  const response = await fetch(targetUrl, {
    method: 'GET',
    headers: {
      Origin: 'https://parselsorgu.tkgm.gov.tr',
      Referer: 'https://parselsorgu.tkgm.gov.tr/',
      Accept: 'application/json',
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
    },
    signal: AbortSignal.timeout(12000),
  });

  const text = await response.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }

  return { ok: response.ok, status: response.status, data };
}

function mapAdminFeatures(payload: any): { id: number; text: string }[] {
  const features = Array.isArray(payload?.features) ? payload.features : [];
  return features
    .map((f: any) => ({
      id: Number(f?.properties?.id),
      text: String(f?.properties?.text || '').trim(),
    }))
    .filter((item: { id: number; text: string }) => Number.isFinite(item.id) && item.id > 0 && item.text.length > 0)
    .sort((a: { text: string }, b: { text: string }) => a.text.localeCompare(b.text, 'tr'));
}

// 1. TKGM İl Listesi
app.get('/api/tkgm/iller', async (_req, res) => {
  try {
    const result = await fetchTkgmUpstream('/idariYapi/ilListe');
    if (!result.ok || !result.data) {
      return res.status(502).json({ error: 'TKGM il listesi şu anda alınamadı.' });
    }
    return res.json({ items: mapAdminFeatures(result.data) });
  } catch (err: any) {
    console.error('TKGM ilListe error:', err?.message);
    return res.status(504).json({ error: 'TKGM servisine bağlanılamadı veya zaman aşımı oluştu.' });
  }
});

// 2. TKGM İlçe Listesi
app.get('/api/tkgm/ilceler/:ilId', async (req, res) => {
  const { ilId } = req.params;
  if (!/^\d{1,10}$/.test(ilId)) {
    return res.status(400).json({ error: 'Geçersiz il kodu.' });
  }
  try {
    const result = await fetchTkgmUpstream(`/idariYapi/ilceListe/${ilId}`);
    if (!result.ok || !result.data) {
      return res.status(502).json({ error: 'TKGM ilçe listesi alınamadı.' });
    }
    return res.json({ items: mapAdminFeatures(result.data) });
  } catch (err: any) {
    console.error('TKGM ilceListe error:', err?.message);
    return res.status(504).json({ error: 'TKGM ilçe listesi zaman aşımına uğradı.' });
  }
});

// 3. TKGM Mahalle / Köy Listesi
app.get('/api/tkgm/mahalleler/:ilceId', async (req, res) => {
  const { ilceId } = req.params;
  if (!/^\d{1,10}$/.test(ilceId)) {
    return res.status(400).json({ error: 'Geçersiz ilçe kodu.' });
  }
  try {
    const result = await fetchTkgmUpstream(`/idariYapi/mahalleListe/${ilceId}`);
    if (!result.ok || !result.data) {
      return res.status(502).json({ error: 'TKGM mahalle listesi alınamadı.' });
    }
    return res.json({ items: mapAdminFeatures(result.data) });
  } catch (err: any) {
    console.error('TKGM mahalleListe error:', err?.message);
    return res.status(504).json({ error: 'TKGM mahalle listesi zaman aşımına uğradı.' });
  }
});

// 4. TKGM Koordinat ile Parsel Sorgulama
app.get('/api/tkgm/parsel/koordinat', async (req, res) => {
  const latRaw = String(req.query.lat || '').trim();
  const lngRaw = String(req.query.lng || '').trim();
  const lat = Number(latRaw);
  const lng = Number(lngRaw);

  if (
    !latRaw ||
    !lngRaw ||
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    lat < -90 ||
    lat > 90 ||
    lng < -180 ||
    lng > 180
  ) {
    return res.status(400).json({ error: 'Geçerli enlem ve boylam koordinatları gereklidir.' });
  }

  try {
    const result = await fetchTkgmUpstream(`/parsel/${lat}/${lng}/`);
    if (result.status === 404 || !result.data || (!result.data.properties && !result.data.features?.[0])) {
      return res.status(404).json({
        error: 'Bu koordinatta kayıtlı bir kadastro parseli bulunamadı (tescil dışı alan veya yol olabilir).',
      });
    }
    if (!result.ok) {
      return res.status(result.status === 429 ? 429 : 502).json({
        error:
          result.status === 429
            ? 'TKGM servisinde yoğunluk nedeniyle geçici sınır aşıldı, lütfen biraz sonra tekrar deneyin.'
            : 'TKGM parsel sorgu servisi geçici olarak yanıt veremedi.',
      });
    }

    const feature = result.data.type === 'FeatureCollection' ? result.data.features?.[0] : result.data;
    if (!feature || !feature.properties) {
      return res.status(404).json({ error: 'TKGM yanıtında parsel kaydı bulunamadı.' });
    }
    return res.json({ feature });
  } catch (err: any) {
    console.error('TKGM coordinate lookup error:', err?.message);
    return res.status(504).json({ error: 'TKGM parsel sorgusuna bağlanılamadı veya zaman aşımı oluştu.' });
  }
});

// 5. TKGM Mahalle / Ada / Parsel ile Sorgulama
app.get('/api/tkgm/parsel/ada', async (req, res) => {
  const mahalleId = String(req.query.mahalleId || '').trim();
  const ada = String(req.query.ada || '').trim();
  const parsel = String(req.query.parsel || '').trim();

  if (!/^\d{1,12}$/.test(mahalleId) || !/^\d{1,10}$/.test(ada) || !/^\d{1,10}$/.test(parsel)) {
    return res.status(400).json({ error: 'Mahalle kodu, ada ve parsel numarası geçerli tam sayı olmalıdır.' });
  }

  try {
    const result = await fetchTkgmUpstream(`/parsel/${mahalleId}/${ada}/${parsel}`);
    if (result.status === 404 || !result.data || (!result.data.properties && !result.data.features?.[0])) {
      return res.status(404).json({
        error: `Girilen mahallede ${ada} ada / ${parsel} parsel numarası ile kayıt bulunamadı.`,
      });
    }
    if (!result.ok) {
      return res.status(result.status === 429 ? 429 : 502).json({
        error:
          result.status === 429
            ? 'TKGM servisinde yoğunluk nedeniyle geçici sınır aşıldı, lütfen biraz sonra tekrar deneyin.'
            : 'TKGM ada/parsel sorgu servisi geçici olarak yanıt veremedi.',
      });
    }

    const feature = result.data.type === 'FeatureCollection' ? result.data.features?.[0] : result.data;
    if (!feature || !feature.properties) {
      return res.status(404).json({ error: 'TKGM yanıtında parsel kaydı bulunamadı.' });
    }
    return res.json({ feature });
  } catch (err: any) {
    console.error('TKGM ada/parsel lookup error:', err?.message);
    return res.status(504).json({ error: 'TKGM ada/parsel sorgusuna bağlanılamadı veya zaman aşımı oluştu.' });
  }
});

// Dev server or Production static serving
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static('dist'));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve('dist/index.html'));
    });
  }

  const PORT = 3000;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running at http://0.0.0.0:${PORT}`);
  });
}

startServer();
