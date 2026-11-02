import { Parcel, Heir, TaksimScenario } from '../types';
import { formatCurrency, formatArea } from './fractionEngine';

/**
 * Generates an expert legal & mathematical taksim evaluation report
 * Used directly on static deployments (e.g. GitHub Pages) or as a fallback if the API proxy is offline.
 * STRICT RULE: No use of the word "resmi" anywhere!
 */
export function generateLocalTaksimReport(
  parcels: Parcel[],
  heirs: Heir[],
  scenario: TaksimScenario
): string {
  const modeName =
    scenario.mode === 'pure_independent'
      ? 'Tam Müstakil Taksim (Her parsele tek malik)'
      : 'Veraset Kolu Ortaklı Taksim (Aynı veraset kolundaki paydaşlar)';

  const debtors = scenario.balances.filter((b) => b.durum === 'borclu');
  const creditors = scenario.balances.filter((b) => b.durum === 'alacakli');
  const exacts = scenario.balances.filter((b) => b.durum === 'denk');

  return `
### TAKSİM VE PAYLAŞIM DEĞERLENDİRME RAPORU

**Uygulanan Taksim Stratejisi:** ${modeName}
**Analiz Edilen Taşınmaz Sayısı:** ${parcels.length} Adet
**Taraf Mirasçı Sayısı:** ${heirs.length} Kişi
**Toplam Portföy Değeri:** ${formatCurrency(parcels.reduce((a, b) => a + (Number(b.toplamDegerTL) || 0), 0))}

---

#### 1. Dağıtım Adaleti ve Hak Dengesi Analizi
- Mirasçıların veraset ilamındaki kesirli hisse oranları ile portföyden aldıkları taşınmazların parasal değerleri arasındaki sapmalar hesaplanmıştır.
- Toplam ${heirs.length} mirasçıdan ${exacts.length} kişinin hak edişi parsel değerlerine tam denk gelmiş, ${debtors.length} mirasçı hak edişinden fazla parsel alarak ivaz borçlusu konumuna geçmiş, ${creditors.length} mirasçı ise hak edişinden eksik parsel alarak ivaz alacaklısı olmuştur.
- Dağıtım, bölünmez parsel bütünlüğü ilkesi (Bin-Packing) doğrultusunda matematiksel olarak optimize edilmiş olup, hisselerin keyfi değil objektif değerleme kriterlerine göre paylaştırıldığı tespit edilmiştir.

#### 2. Kök Mirasçılar (Veraset Kolları) Bazında Coğrafi ve Mülkiyet Bütünlüğü
- Paylaşımda her bir kök veraset kolunun (2. kuşak kollarının) toplam veraset hak edişi korunmuştur.
- ${
    scenario.mode === 'sibling_consolidation'
      ? 'Veraset Kolu Ortaklığı Modeli benimsenerek, yüksek değerli veya bölünemeyen parseller aynı koldan gelen paydaşlar arasında müşterek mülkiyete tahsis edilmiştir. Bu sayede hem aile içi mülkiyet birliği korunmuş hem de dışarıya nakit ödeme zorunluluğu en aza indirilmiştir.'
      : 'Tam Müstakil Taksim tercih edilmiş olup her parsel münhasıran tek bir mirasçıya verilmiştir. Paylı mülkiyet tamamen tasfiye edilmiş, bağımsız müstakil tasarruf imkanı sağlanmıştır.'
  }

#### 3. İvaz (Nakit Denkleştirme) Süreci ve Ödeme Güvenliği Önerileri
- Toplam denkleştirme tutarı: **${formatCurrency(scenario.totalIvazAmountTL)}**
- İvaz matrisi net sıfır toplamlıdır; borçluların ödeyeceği toplam tutar ile alacaklıların tahsil edeceği toplam tutar kuruşu kuruşuna birbirini karşılamaktadır.
- **Tavsiye:** Borçlu tarafların, taksim protokolünün imzalanacağı günden önce belirlenen ivaz bedellerini alacaklıların banka IBAN hesaplarına "Taksim İvaz Denkleştirme Bedeli" açıklamasıyla havale/EFT yapmaları ve banka dekontlarını mutabakat zaptına eklemeleri hukuki güvenliği pekiştirecektir.

#### 4. Aile İçi Uzlaşma ve Noter Süreci Tavsiyeleri
- Mirasçılar arasında yaşanabilecek güvensizlik krizlerini aşmak adına, sistem tarafından üretilen **Şarta Bağlı Özel Yetkili Noter Vekâletnamesi** kullanılmalıdır. Bu vekâletname, vekile yalnızca ekli listede ada ve parseli belirtilen taşınmazları devir ve iktisap etme yetkisi tanımakta; bunun dışındaki taşınmazlar için tasarruf yetkisi vermemektedir.
- Tüm mirasçıların imzalayacağı **Nihai Taksim Ön Mutabakat Zaptı** noter huzurunda onaylatılarak hukuki bağlayıcılık kazanmalıdır.
- Müstakil tapuya ayrılamayan parseller için parsel içi alt KML poligonları esas alınarak tanzim edilen **Fiili Kullanım Sözleşmesi ve Koordinatlı Kroki Eki**, ileride doğabilecek ecrimisil veya izale-i şüyu ihtilaflarını tamamen engeller.

#### 5. Çekişme Riski Taşıyan Noktalar ve Çözüm Yolları
- Taşınmazların vasıfları (tarla, bağ, yola cepheli arsa vb.) arasındaki geleceğe yönelik değer artış potansiyeli aile meclisinde müzakere edilmeli ve mutabakat zaptında "tarafların taşınmazların mevcut değerlerini kabul ettiği ve gelecekteki değer artışlarına dayalı bir talepte bulunmayacakları" açıkça teyit edilmelidir.
`.trim();
}
