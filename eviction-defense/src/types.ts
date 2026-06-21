export interface ParsedNotice {
  noticeType: "pay-or-quit" | "cure-or-quit" | "unconditional-quit" | "no-fault" | "unknown";
  landlordName: string;
  tenantName: string;
  propertyAddress: string;
  state: string;
  amountOwed?: number;
  deadlineDays: number;
  deadlineDate?: string;
  reasonForEviction: string;
  servingMethod?: string;
  rawText: string;
}

export interface TenantRights {
  state: string;
  minimumNoticeDays: Record<string, number>;
  requiredDisclosures: string[];
  illegalReasons: string[];
  retaliationProtections: string[];
  rentControlCities?: string[];
  notes: string[];
}

export interface Violation {
  type: "notice-period" | "missing-disclosure" | "illegal-reason" | "retaliation" | "procedural";
  description: string;
  legalBasis: string;
  severity: "high" | "medium" | "low";
}

export interface AnalysisResult {
  parsedNotice: ParsedNotice;
  violations: Violation[];
  defenseSummary: string;
  recommendedActions: string[];
  defenseLetter: string;
  disclaimer: string;
}
