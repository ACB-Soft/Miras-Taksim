import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { ProjectState } from '../types';
import {
  generateConditionalNotaryPowerOfAttorney,
  generateTaksimAccordProtocol,
  generateFiiliTaksimSozlesmesi,
} from './notaryDocGenerator';

/**
 * Creates and downloads a complete .ZIP package containing project data, KMLs, and notary drafts
 */
export async function exportProjectToZip(project: ProjectState): Promise<void> {
  const zip = new JSZip();

  // 1. Core Project JSON
  zip.file('project_data.json', JSON.stringify(project, null, 2));

  // 2. Readme
  const readmeContent = `
================================================================================
MİRAS TAKSİM VE FİİLİ KULLANIM YÖNETİMİ PROJE YEDEĞİ
================================================================================
Proje Adı       : ${project.projectName || 'Miras Taksimi'}
Yedekleme Tarihi: ${new Date().toLocaleString('tr-TR')}
Toplam Parsel   : ${project.parcels.length}
Toplam Mirasçı  : ${project.heirs.length}
Seçili Taksim   : ${project.selectedScenarioMode === 'pure_independent' ? 'Tam Müstakil' : 'Veraset Kolu Ortaklı'}

Bu arşiv dosyası Miras Taksim PWA uygulamasına doğrudan yüklenerek ("Dosyadan ZIP Yükle")
tüm parsel, hisse, optimizasyon ve noter taslaklarıyla kaldığınız yerden devam etmenizi sağlar.

İçerik:
- project_data.json               : Tüm projenin yapılandırılmış sayısal veri tabanı
- noter_taslaklari/               : Noter onayına ve imzaya hazır ön mutabakat metinleri
- noter_taslaklari/vekaletnameler/: Her mirasçı için şarta bağlı özel yetkili vekaletname taslakları
- kml_dosyalari/                  : Taşınmaz kadastro ve alt kullanım sınırları KML dökümleri
================================================================================
`.trim();
  zip.file('beni_oku.txt', readmeContent);

  // 3. Notary Documents Folder
  const docsFolder = zip.folder('noter_taslaklari');
  const activeScenario =
    project.selectedScenarioMode === 'pure_independent'
      ? project.scenarios.pure_independent
      : project.scenarios.sibling_consolidation;

  if (activeScenario && docsFolder) {
    // Protocol Accord
    const protocolText = generateTaksimAccordProtocol(
      project.projectName,
      project.heirs,
      project.parcels,
      activeScenario
    );
    docsFolder.file('Nihai_Taksim_On_Mutabakat_Zapti.txt', protocolText);

    // In-Parcel Fiili Taksim Agreements for parcels having sub-usage areas
    project.parcels.forEach((parcel) => {
      if (parcel.subUsageAreas && parcel.subUsageAreas.length > 0) {
        const fiiliText = generateFiiliTaksimSozlesmesi(
          parcel,
          parcel.subUsageAreas,
          project.heirs
        );
        docsFolder.file(
          `Fiili_Taksim_Sozlesmesi_Ada_${parcel.ada}_Parsel_${parcel.parselNo}.txt`,
          fiiliText
        );
      }
    });

    // Individual POAs
    const poaFolder = docsFolder.folder('vekaletnameler');
    if (poaFolder) {
      project.heirs.forEach((heir) => {
        const pIds = activeScenario.assignments[heir.id] || [];
        const heirParcels = project.parcels.filter((p) => pIds.includes(p.id));
        const poaText = generateConditionalNotaryPowerOfAttorney(heir, heirParcels);
        const safeName = heir.adSoyad.replace(/[^a-zA-Z0-9ığüşöçİĞÜŞÖÇ_ -]/g, '_');
        poaFolder.file(`Vekaletname_${safeName}.txt`, poaText);
      });
    }
  }

  // 4. Generate & trigger zip download
  const blob = await zip.generateAsync({ type: 'blob' });
  const safeProjectName = (project.projectName || 'Miras_Taksim').replace(/\s+/g, '_');
  const fileName = `${safeProjectName}_Arsiv_${new Date().toISOString().slice(0, 10)}.zip`;
  saveAs(blob, fileName);
}

/**
 * Imports project data from a user-selected .ZIP file
 */
export async function importProjectFromZip(file: File): Promise<ProjectState> {
  const zip = await JSZip.loadAsync(file);

  // Look for project_data.json
  const jsonFile = zip.file('project_data.json');
  if (!jsonFile) {
    throw new Error('Geçersiz arşiv dosyası: project_data.json bulunamadı.');
  }

  const jsonContent = await jsonFile.async('string');
  const projectData: ProjectState = JSON.parse(jsonContent);

  if (!projectData.parcels || !projectData.heirs) {
    throw new Error('Geçersiz veri yapısı: Parsel veya mirasçı verisi eksik.');
  }

  return projectData;
}
