
import { supabase } from './supabase';
import { UserRecord, TrainingSample, ROIConfig, AIModelConfig } from '../types';
import { INITIAL_ROIS } from '../constants';

export const StorageService = {
  // 支持分页查询，并进行字段映射清洗
  getRecords: async (page: number = 1, pageSize: number = 10): Promise<{ data: UserRecord[], count: number }> => {
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    // 使用 count: 'exact' 获取总数
    const { data, error, count } = await supabase
      .from('ocr_records')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to);
    
    if (error || !data) return { data: [], count: 0 };

    // 数据清洗：将 DB 的 snake_case 转换为前端的 camelCase
    const mappedData: UserRecord[] = data.map((row: any) => ({
      id: row.id,
      timestamp: new Date(row.created_at).getTime(), // 转换时间戳
      imageUrl: row.image_url, // 映射图片字段
      status: row.status,
      consensusRate: row.consensus_rate, // 映射共识率
      corrections: row.corrections,
      result: {
        ok: true, // DB中未存储，给默认值
        used_image: 'raw',
        quality: { ok: true, metrics: { blur_var: 0, brightness_mean: 0, dark_ratio: 0 }, warnings: [] },
        // DB中存储的是 JSONB，直接使用
        primaryFields: row.primary_fields || {},
        secondaryFields: row.secondary_fields || {},
        warnings: [],
        latency_ms: row.latency_ms || 0
      }
    }));

    return { data: mappedData, count: count || 0 };
  },
  
  saveRecord: async (record: UserRecord) => {
    await supabase.from('ocr_records').insert([{
      id: record.id,
      image_url: record.imageUrl,
      primary_fields: record.result.primaryFields,
      secondary_fields: record.result.secondaryFields,
      status: record.status,
      consensus_rate: record.consensusRate,
      latency_ms: record.result.latency_ms
    }]);
  },

  updateRecordStatus: async (id: string, status: 'reviewed', corrections: Record<string, string>) => {
    await supabase.from('ocr_records').update({ status, corrections }).eq('id', id);
  },

  getSamples: async (): Promise<TrainingSample[]> => {
    const { data } = await supabase.from('training_samples').select('*').order('created_at', { ascending: false }).limit(50);
    return (data || []) as TrainingSample[];
  },

  addSample: async (sample: TrainingSample, recordId?: string) => {
    await supabase.from('training_samples').insert([{
      record_id: recordId,
      corrections: sample.corrections,
      accuracy: sample.accuracy
    }]);
  },

  getROIs: async (): Promise<ROIConfig> => {
    const { data } = await supabase.from('roi_configs').select('data').eq('is_active', true).limit(1).single();
    return data ? (data.data as ROIConfig) : INITIAL_ROIS;
  },

  updateROIs: async (config: ROIConfig) => {
    await supabase.from('roi_configs').update({ data: config }).eq('is_active', true);
  },

  getModelConfig: async (): Promise<AIModelConfig> => {
    const { data, error } = await supabase.from('model_configs').select('*').eq('is_active', true).limit(1).single();
    
    const isInvalid = error || !data || !data.url || !data.api_key;
    const isOldBrokenUrl = data && data.url && data.url.includes('anapi-uat');

    if (isInvalid || isOldBrokenUrl) {
      console.warn("Detecting invalid or broken config, falling back to Volcengine default.");
      return {
        url: 'https://ark.cn-beijing.volces.com/api/v3',
        api_key: '5f8b1a19-5288-4464-b54b-904f88a47bac',
        model_name: 'doubao-seed-1-8-251228'
      };
    }
    return data as AIModelConfig;
  },

  updateModelConfig: async (config: AIModelConfig) => {
    if (!config.url.startsWith('http')) {
      throw new Error("URL 必须以 http 或 https 开头");
    }
    const { error } = await supabase.from('model_configs').update({
      url: config.url.trim(),
      api_key: config.api_key.trim(),
      model_name: config.model_name.trim()
    }).eq('is_active', true);
    if (error) throw error;
  },

  // 修改：支持 File 或 Blob (用于上传压缩后的图片)
  uploadImage: async (file: File | Blob): Promise<string> => {
    // 压缩后的 Blob 默认后缀为 jpg
    let fileExt = 'jpg';
    if (file instanceof File && file.name) {
      const parts = file.name.split('.');
      if (parts.length > 1) fileExt = parts.pop() || 'jpg';
    }
    
    const fileName = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${fileExt}`;
    const filePath = `${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('contracts')
      .upload(filePath, file, {
        contentType: 'image/jpeg' // 强制指定类型，因为我们主要上传压缩后的 JPEG
      });

    if (uploadError) {
      throw new Error(`图片上传失败: ${uploadError.message}`);
    }

    const { data } = supabase.storage
      .from('contracts')
      .getPublicUrl(filePath);

    return data.publicUrl;
  }
};
