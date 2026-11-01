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
