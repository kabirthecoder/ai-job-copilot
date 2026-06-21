export interface PackagingExtraction {
  drugName: string;
  brandName?: string;
  genericName?: string;
  manufacturer: string;
  batchNumber?: string;
  expiryDate?: string;
  manufactureDate?: string;
  dosageForm?: string;
  strength?: string;
  countryOfOrigin?: string;
  registrationNumber?: string;
  verificationCode?: string;
  barcode?: string;
  storageConditions?: string;
  activeIngredients: string[];
  allTextExtracted: string;
  languagesDetected: string[];
  hasHologram: boolean;
  hasQRCode: boolean;
  hasScratchCode: boolean;
}

export interface FDADrugRecord {
  found: boolean;
  brandNames: string[];
  genericName?: string;
  manufacturers: string[];
  dosageForms: string[];
  activeIngredients: string[];
  indications?: string;
  warnings?: string;
  hasRecalls: boolean;
  recalls: FDARecall[];
}

export interface FDARecall {
  recallDate: string;
  reason: string;
  product: string;
  company: string;
  status: string;
}

export interface WHOAlert {
  id: string;
  alertDate: string;
  productName: string;
  manufacturer: string;
  batchNumbers: string[];
  countries: string[];
  alertType: "substandard" | "falsified" | "unregistered";
  description: string;
  source: string;
}

export interface VisualAnalysis {
  overallQuality: "high" | "medium" | "low" | "very-low";
  printQualityScore: number;
  spellingErrors: string[];
  fontInconsistencies: string[];
  colorAnomalies: string[];
  packagingDefects: string[];
  suspiciousElements: string[];
  authenticElements: string[];
  batchNumberFormatValid: boolean;
  expiryFormatValid: boolean;
}

export interface RegistryResult {
  name: string;
  region: string;
  flag: string;
  found: boolean;
  status?: string;
  details?: string;
}

export interface MedicineEncyclopedia {
  drugName: string;
  iupacName?: string;
  molecularFormula?: string;
  whatIsIt: string;
  discoveryAndHistory: string;
  medicalUses: string[];
  mechanismOfAction: string;
  isWHOEssential: boolean;
  essentialMedicineCategory?: string;
  commonBrandNames: string[];
  keyWarnings: string[];
  sideEffects: string[];
  interestingFacts: string[];
  wikipediaUrl?: string;
  pubchemUrl?: string;
  pubchemCID?: number;
}

export interface RedFlag {
  severity: "critical" | "high" | "medium" | "low";
  category: "visual" | "database" | "who-alert" | "recall" | "format" | "text" | "registry";
  description: string;
}

export interface AuthenticityVerdict {
  score: number;
  verdict: "authentic" | "likely-authentic" | "suspicious" | "likely-counterfeit" | "counterfeit";
  confidence: "high" | "medium" | "low";
  redFlags: RedFlag[];
  positiveSignals: string[];
  matchedWHOAlert?: WHOAlert;
  fdaStatus: "verified" | "recalled" | "not-found" | "unknown";
  immediateAction: string;
  detailedExplanation: string;
}

export interface AnalysisResult {
  packaging: PackagingExtraction;
  fdaRecord: FDADrugRecord;
  whoAlertMatch: WHOAlert | null;
  globalRegistries: RegistryResult[];
  visualAnalysis: VisualAnalysis;
  verdict: AuthenticityVerdict;
  encyclopedia: MedicineEncyclopedia;
  verificationGuidance: string[];
  disclaimer: string;
}
