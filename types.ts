
export interface ROIField {
  coords: [number, number, number, number];
  label: string;
}

export interface ROIConfig {
  template_size_hint: [number, number];
  fields: Record<string, ROIField>;
}

export interface AIModelConfig {
  id?: number;
  url: string;
  api_key: string;
  model_name: string;
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
  id: string;
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

// 新增：前端队列任务类型
export interface QueuedTask {
  internalId: string; // 前端生成的临时ID
  file: File;
  preview: string;
  status: 'pending' | 'compressing' | 'uploading' | 'extracting' | 'completed' | 'failed';
  progressLabel: string; // 用于显示当前具体在做什么
  result?: OCRResult; // 成功后的结果
  recordId?: string; // 成功后的 DB ID
  errorMsg?: string;
  consensusRate?: number;
}
