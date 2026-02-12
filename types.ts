
export interface ROIField {
  coords: [number, number, number, number];
  label: string;
}

export interface ROIConfig {
  template_size_hint: [number, number];
  fields: Record<string, ROIField>;
}

export interface FieldResult {
  value: string;
  conf: number;
  raw: string;
}

export interface OCRResult {
  ok: boolean;
  used_image: 'aligned' | 'raw';
  quality: {
    ok: boolean;
    metrics: {
      blur_var: number;
      brightness_mean: number;
      dark_ratio: number;
    };
    warnings: string[];
  };
  primaryFields: Record<string, FieldResult>;
  secondaryFields: Record<string, FieldResult>;
  warnings: string[];
  latency_ms: number;
}

export interface UserRecord {
  id: string; // OCR-20231027-001
  timestamp: number;
  imageUrl: string;
  result: OCRResult;
  status: 'pending' | 'reviewed';
  consensusRate: number;
  corrections?: Record<string, string>;
}

export interface TrainingSample {
  id: string;
  timestamp: number;
  corrections: Record<string, string>;
  accuracy: number;
}

export interface HistoryStats {
  date: string;
  accuracy: number;
}

export interface Rect {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}
