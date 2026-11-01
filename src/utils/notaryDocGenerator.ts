import { Heir, Parcel, SubUsageArea, TaksimScenario } from '../types';
import { formatCurrency, formatArea } from './fractionEngine';

/**
 * Generates Conditional Limited Notary Power of Attorney Draft
 * STRICT RULE: No use of the word "resmi" anywhere!
 */
export function generateConditionalNotaryPowerOfAttorney(
  heir: Heir,
  assignedParcels: Parcel[],
  vekilName: string = '[VEKİL TAYİN EDİLEN MİRASÇI ADI SOYADI / AVUKAT]'
): string {
  const parcelRows = assignedParcels.map(
    (p, idx) =>
      `  ${idx + 1}. Ada: ${p.ada}, Parsel: ${p.parselNo}, Mevkii: ${p.mevkii || '-'}, Alan: ${formatArea(p.alanM2)}, Nitelik: ${p.nitelik}, Taksim Değeri: ${formatCurrency(p.toplamDegerTL)}`
  ).join('\n');

  return `
T.C. NOTERLİĞİ'NE
(ŞARTA VE LİSTEYE BAĞLI ÖZEL YETKİLİ VEKÂLETNAME TASLAĞI)

MÜVEKKİL (VEREN)     : ${heir.adSoyad}
T.C. KİMLİK NO        : ${heir.tcKimlik || '...........................'}
ADRES                 : ............................................................................................
VERASET HİSSE ORANI   : ${heir.hisseOrani}

VEKİL (TAYİN EDİLEN)  : ${vekilName}
T.C. KİMLİK NO        : ...........................

VEKÂLETİN KONUSU VE ÖZEL SINIRLANDIRMA HÜKMÜ:
Müvekkili olduğum muris terekesine dahil taşınmazların mirasçılar arasında rızai olarak taksimi, müstakil tapuya tescili ve ifraz işlemlerinde beni temsil etmek üzere;

ÖZEL ŞART VE SINIRLILIK KAYDI (MÜTEMMİM CÜZ HÜKMÜ):
İşbu vekâletname genel bir vekâletname OLMAYIP, münhasıran aşağıda dökümü yapılan ve işbu vekâletnamenin ayrılmaz eki ve mütemmim cüzü sayılan taşınmazlar ile sınırlıdır.
Vekil;
1. Müvekkil adına yalnızca aşağıda ada, parsel ve nitelikleri açıkça yazılı taşınmazları müvekkil mülkiyetine tescil ettirmeye ve hisse devirlerini almaya yetkilidir.
2. İşbu vekâletnamede açıkça sayılmayan, ek listede yer almayan tereke dahilindeki veya müvekkilin şahsi mülkiyetindeki BAŞKA HİÇBİR TAŞINMAZI üçüncü şahıslara satmaya, devretmeye, ipotek tesis etmeye, ferağ vermeye, bağışlamaya veya tasarrufta bulunmaya KESİNLİKLE YETKİLİ DEĞİLDİR.
3. Taşınmazların taksimi sonucu doğacak nakit ivaz (denkleştirme bedeli) ödemelerini müvekkil adına açılmış banka hesabına yatırtmaya yetkili olup, kendi şahsına tahsilat yapamaz.

MÜTEMMİM CÜZ EK LİSTE (YETKİ VERİLEN TAŞINMAZLAR):
${parcelRows || '  (Bu malike atanmış taşınmaz bulunmamaktadır - İvaz alacaklısı)'}

Yukarıda kayıtlı şart ve sınırlamalar dairesinde, ilgili Tapu Müdürlükleri, Kadastro Müdürlükleri ve Noterlikler nezdinde taksim sözleşmelerini imzalamaya, tapu senetlerini tesellüm etmeye mezun ve yetkili kılınmıştır.

TARİH : ...... / ...... / 202...

MÜVEKKİL ADI SOYADI / İMZA:
${heir.adSoyad}
`.trim();
}

/**
 * Generates the Final Partition Accord Protocol between all heirs
 * STRICT RULE: No use of the word "resmi" anywhere!
 */
export function generateTaksimAccordProtocol(
  projectName: string,
  heirs: Heir[],
  parcels: Parcel[],
  scenario: TaksimScenario
): string {
  const currentDate = new Date().toLocaleDateString('tr-TR');

  // Parties list
  const partyList = heirs
    .map(
      (h, idx) =>
        `${idx + 1}. ${h.adSoyad} (T.C.: ${h.tcKimlik || '....................'}, Hisse: ${h.hisseOrani}, Hak Edilen: ${formatCurrency(h.hakEdilenTL || 0)})`
    )
    .join('\n');

  // Allocation matrix
  const allocationRows = scenario.balances
    .map((b) => {
      const pList = b.aldigiParselAdlari.length > 0 ? b.aldigiParselAdlari.join(', ') : 'Taşınmaz almadı (Nakit ivaz bedeli ödenecektir)';
      const diffStr =
        b.durum === 'borclu'
          ? `+${formatCurrency(b.netFarkTL)} (İVAZ BORÇLUSU - ÖDEYECEK)`
          : b.durum === 'alacakli'
          ? `-${formatCurrency(Math.abs(b.netFarkTL))} (İVAZ ALACAKLISI - TAHSİL EDECEK)`
          : '0,00 TL (TAM DENK)';

      return `
Mirasçı: ${b.heirName} (Hisse: ${b.hisseOrani})
- Hak Ediş Tutarı          : ${formatCurrency(b.hakEdilenTL)}
- İsabet Eden Taşınmazlar  : ${pList}
- Taşınmaz Değerleri Topl. : ${formatCurrency(b.aldigiParsellerDegeriTL)}
- Denkleştirme (İvaz) Durumu: ${diffStr}
--------------------------------------------------------------------------------`;
    })
    .join('\n');

  // Equalization items table
  const ivazRows =
    scenario.equalizationItems.length > 0
      ? scenario.equalizationItems
          .map(
            (item, idx) =>
              `${idx + 1}. [BORÇLU] ${item.debtorName} ---> [ALACAKLI] ${item.creditorName} : ${formatCurrency(item.amountTL)}`
          )
          .join('\n')
      : 'Herhangi bir nakit denkleştirme ödemesi gerekmemektedir (Tam denklik).';

  return `
MİRAS TAKSİMİ NİHAİ ÖN MUTABAKAT ZAPTI VE PAYLAŞIM PROTOKOLÜ

PROJE VE TEREKE ADI : ${projectName || 'Miras Taksim Projesi'}
DÜZENLENME TARİHİ   : ${currentDate}
UYGULANAN YÖNTEM    : ${scenario.name}

1. TARAFLAR (MİRASÇILAR / HİSSEDARLAR):
Aşağıda kimlik ve veraset pay bilgileri yer alan taraflar, muristen intikal eden taşınmazların rızai taksimi hususunda tam bir mutabakat ve irade birliği ile işbu protokolü tanzim ve imza etmişlerdir:
${partyList}

2. TAKSİME KONU TAŞINMAZLARIN PAYLAŞIM VE İSABET CETVELİ:
Tarafların ortak kararı ve uzman matematiksel optimizasyon ilkeleri doğrultusunda, toplam ${parcels.length} adet taşınmazın paydaşlar arasındaki müstakil mülkiyet tevzi cetveli aşağıda tespit edilmiştir:
${allocationRows}

3. NAKİT İVAZ (DENKLEŞTİRME BEDELİ) VE ÖDEME TAKVİMİ:
Taşınmazların değerleri ile paydaşların veraset hisseleri arasındaki farklar, Türk Medeni Kanunu'nun ilgili hükümleri dairesinde nakden denkleştirilecek (ivazlaşma) olup, taraflar aşağıdaki ödeme planını gayrikabili rücu kabul, beyan ve taahhüt ederler:

${ivazRows}

Ödeme Şartı: Yukarıda adı geçen borçlu hissedarlar, ilgili ivaz tutarlarını tapuda taksim ve ferağ işlemlerinin yapılacağı tarihten en geç 3 (üç) iş günü öncesine kadar alacaklı hissedarların bildireceği banka IBAN numaralarına defaten ve eksiksiz olarak ödeyeceklerdir.

4. FERAĞ VE TAPU TESCİL TAAHHÜDÜ:
Taraflar, yukarıda kendilerine isabet ettiği belirlenen taşınmazlar haricinde kalan diğer taşınmazlardaki tüm miras ve mülkiyet haklarından feragat ettiklerini, ilgili Tapu Müdürlüğü huzurunda diğer paydaşlar lehine ferağ takrirlerini tereddütsüz vereceklerini kabul ve taahhüt ederler.

5. UYUŞMAZLIKLARIN ÇÖZÜMÜ:
İşbu ön mutabakat zaptı, noter huzurunda düzenlenecek nihai taksim sözleşmesinin esasını teşkil eder. Taraflar, iyi niyet ve ailevi tesanüt kuralları çerçevesinde hareket etmeyi taahhüt ederler.

İşbu protokol 5 (beş) maddeden ibaret olup, tüm paydaşlarca okunup anlaşılarak hür iradeleriyle imza altına alınmıştır.

İMZALAR (TÜM MİRASÇILAR):
${heirs.map((h) => `\n[ ......................................... ]\n${h.adSoyad}\nT.C.: ${h.tcKimlik || '....................'}\n`).join('')}
`.trim();
}

/**
 * Generates the In-Parcel Fiili Taksim & Usage Agreement with sketch coordinates
 * STRICT RULE: No use of the word "resmi" anywhere!
 */
export function generateFiiliTaksimSozlesmesi(
  parcel: Parcel,
  subUsageAreas: SubUsageArea[],
  heirs: Heir[]
): string {
  const currentDate = new Date().toLocaleDateString('tr-TR');

  const subAreaRows = subUsageAreas.map((sub, idx) => {
    const heir = heirs.find((h) => h.id === sub.assignedHeirId);
    const heirName = heir ? heir.adSoyad : (sub.assignedHeirName || 'Tahsis Yapılmadı');
    const tcNo = heir?.tcKimlik || '...........................';
    const coordSummary = sub.coordinates
      .slice(0, 4)
      .map(([lat, lng]) => `(${lat.toFixed(6)}, ${lng.toFixed(6)})`)
      .join(' - ');

    return `
${idx + 1}. KULLANIM BÖLÜMÜ: ${sub.name}
   - Yüzölçümü             : ${formatArea(sub.alanM2)}
   - Tahsis Edilen Malik   : ${heirName} (T.C.: ${tcNo})
   - Sınır Koordinat Özeti : ${coordSummary}
   - Özel Notlar/Açıklama  : ${sub.notes || 'Tarımsal/Kullanım tasarrufu'}
--------------------------------------------------------------------------------`;
  }).join('\n');

  return `
TAŞINMAZ FİİLİ KULLANIM VE RIZAI TAKSİM SÖZLEŞMESİ
(KULLANIM SINIRLARI KROKİSİ VE KOORDİNAT CETVELİ EKİ İLE BİRLİKTE)

ANA TAŞINMAZ BİLGİLERİ:
- İl / İlçe / Mevkii : ${parcel.il || '-' } / ${parcel.ilce || '-'} / ${parcel.mevkii || '-'}
- Ada / Parsel No     : ${parcel.ada} / ${parcel.parselNo}
- Toplam Yüzölçümü   : ${formatArea(parcel.alanM2)}
- Taşınmazın Niteliği: ${parcel.nitelik}
- Düzenlenme Tarihi  : ${currentDate}

1. SÖZLEŞMENİN AMACI:
Yukarıda tapu kaydı yazılı taşınmaz üzerinde müşterek veya iştirak halinde malik bulunan aşağıda imzası olan hissedarlar, taşınmazın müstakil ifrazı tapu kütüğünde tescil edilinceye kadar, taşınmaz üzerindeki fiili kullanım, tasarruf, ekim, dikim ve yararlanma sınırlarını tam bir rıza ile belirlemek üzere işbu sözleşmeyi tanzim etmişlerdir.

2. FİİLİ KULLANIM VE TAHSİS CETVELİ (MÜTEMMİM CÜZ KULLANIM KROKİSİ):
Taşınmaz ekli krokide A, B, C... harfleriyle işaretlenen ve koordinat sınırları belirlenen alt kullanım bölümlerine ayrılmış olup, her hissedarın münhasıran kullanacağı alan aşağıda tevsik edilmiştir:

${subAreaRows || '  (Bu parsel için henüz alt kullanım alanı tanımlanmamıştır)'}

3. MÜDAHALENİN MEN'İ VE KARŞILIKLI TAAHHÜT:
Hissedarlardan hiçbiri, diğer bir hissedara işbu sözleşmeyle tahsis edilmiş bulunan kullanım bölümüne haksız müdahalede bulunamaz, diğer hissedarın tasarrufunu engelleyemez. Her hissedar kendisine tahsis edilen alandan doğan gelir, ürün ve semerelerden tek başına tasarruf etme hakkına sahiptir.

4. NOTER ONAYI VE HUKUKİ NİTELİK:
İşbu sözleşme ve ekindeki koordinatlı kullanım krokisi, hissedarlarca notere tasdik ettirilerek bağlayıcı kılınacak; ileride yapılacak her türlü tapu, kamulaştırma ve ifraz işleminde esas kabul edilecektir.

TARAFLAR / HİSSEDARLAR (İMZALAR):
${heirs.filter(h => subUsageAreas.some(s => s.assignedHeirId === h.id)).map(h => `\n[ ......................................... ]\n${h.adSoyad}\nT.C.: ${h.tcKimlik || '....................'}\n`).join('')}
`.trim();
}
