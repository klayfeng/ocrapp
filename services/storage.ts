
import { supabase } from './supabase';
import { UserRecord, TrainingSample, ROIConfig, AIModelConfig } from '../types';
import { INITIAL_ROIS } from '../constants';

export const StorageService = {
  getRecords: async (): Promise<UserRecord[]> => {
    const { data, error } = await supabase
      .from('ocr_records')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) return [];
    return data as UserRecord[];
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

  // 获取模型配置
  getModelConfig: async (): Promise<AIModelConfig> => {
    const { data, error } = await supabase.from('model_configs').select('*').eq('is_active', true).limit(1).single();
    if (error || !data) {
      return {
        url: 'https://anapi-uat.annto.com/api-sse-ai-ng/v1',
        api_key: 'sk-zNG9y4e6FKmtwEjgWj5K8Q',
        model_name: 'code-default'
      };
    }
    return data as AIModelConfig;
  },

  // 更新模型配置
  updateModelConfig: async (config: AIModelConfig) => {
    const { error } = await supabase.from('model_configs').update({
      url: config.url,
      api_key: config.api_key,
      model_name: config.model_name
    }).eq('is_active', true);
    if (error) throw error;
  }
};
