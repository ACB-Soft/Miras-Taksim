export interface SubUsageArea {
  id: string;
  name: string;
  alanM2: number;
  assignedHeirId?: string; // Hangi mirasçıya tahsis edildiği
  assignedHeirName?: string;
  notes?: string;
  color?: string;
  coordinates: [number, number][]; // [lat, lng][]
  center?: [number, number];
}

export interface Parcel {
  id: string;
  ada: string;
  parselNo: string;
  mevkii?: string;
  ilce?: string;
  il?: string;
  mahalle?: string;
  pafta?: string;
  alanM2: number;
  nitelik: string; // Tarla, Zeytinlik, Bağ, Arsa vb.
  birimFiyatTL: number; // m² birim değeri
  toplamDegerTL: number;
  kmlFileName?: string;
  coordinates: [number, number][]; // [lat, lng][] outer boundary
  center?: [number, number];
  subUsageAreas?: SubUsageArea[]; // Parsel içi alt fiili kullanım alanları (Alt KML)
  notlar?: string;
}

export interface HeirBranch {
  id: string;
  adSoyad: string; // Veraset kolu adı (örn: "1. Veraset Kolu", "Ahmet Kolu")
  kokHisseOrani: string; // Fraction string örn: "1/3"
  aciklama?: string;
}

export interface Heir {
  id: string;
  adSoyad: string;
  tcKimlik?: string;
  telefon?: string;
  kusak: number; // 2, 3, 4 ...
  kokMurisKolId: string; // Hangi veraset koluna bağlı olduğu
  hisseOrani: string; // Fraction string örn: "1/9", "3/72", "1/12"
  hakEdilenTL?: number; // Portföy toplamından aldığı pay
  hakEdilenM2?: number; // Eşdeğer m² hak edişi
  vekilMi?: boolean;
  notlar?: string;
}

export interface EqualizationItem {
  debtorId: string; // Borçlu malik (hak ettiğinden fazla parsel alan)
  debtorName: string;
  creditorId: string; // Alacaklı malik (hak ettiğinden az parsel alan)
  creditorName: string;
  amountTL: number;
  description: string;
}

export interface HeirBalance {
  heirId: string;
  heirName: string;
  kokMurisKolId: string;
  hisseOrani: string;
  hakEdilenTL: number;
  aldigiParsellerDegeriTL: number;
  aldigiParselAdlari: string[];
  netFarkTL: number; // Pozitif: Alacaklı, Negatif: Borçlu, 0: Tam denk
  durum: 'alacakli' | 'borclu' | 'denk';
}

export interface TaksimScenario {
  id: string;
  mode: 'pure_independent' | 'sibling_consolidation';
  name: string;
  description: string;
  assignments: Record<string, string[]>; // heirId -> parcelIds[]
  jointParcels?: Record<string, string[]>; // parcelId -> heirIds[] (kol ortaklığı durumunda)
  balances: HeirBalance[];
  equalizationItems: EqualizationItem[];
  totalIvazAmountTL: number;
  maxDiscrepancyTL: number;
  aiJustification?: string;
  createdAt: string;
}

export interface ProjectState {
  projectName: string;
  aciklama?: string;
  rootOwnerName?: string; // 1. Kuşak ilk mülk sahibi adı (örn. "İlk Mülk Sahibi" veya "Mehmet Bey")
  rootOwnerTitle?: string; // 1. Kuşak unvanı / başlığı (örn. "1. Kuşak · Kök Malik")
  generationNames?: Record<number, string>; // Kuşak özel isimleri { 1: "1. Kuşak", 2: "2. Kuşak", ... }
  parcels: Parcel[];
  branches: HeirBranch[];
  heirs: Heir[];
  selectedScenarioMode: 'pure_independent' | 'sibling_consolidation';
  scenarios: {
    pure_independent?: TaksimScenario;
    sibling_consolidation?: TaksimScenario;
  };
  lastSaved?: string;
}
