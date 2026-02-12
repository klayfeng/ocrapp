
import { supabase } from './supabase';
import { UserRecord, TrainingSample, ROIConfig } from '../types';
import { INITIAL_ROIS } from '../constants';

export const StorageService = {
  getRecords: async (): Promise<UserRecord[]> => {
    const { data, error } = await supabase
      .from('ocr_records')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Fetch records error:', error);
      return [];
    }
    return data as UserRecord[];
  },
  
  saveRecord: async (record: UserRecord) => {
    const { error } = await supabase
      .from('ocr_records')
      .insert([{
        id: record.id,
        image_url: record.imageUrl,
        primary_fields: record.result.primaryFields,
        secondary_fields: record.result.secondaryFields,
        status: record.status,
        consensus_rate: record.consensusRate,
        latency_ms: record.result.latency_ms
      }]);
    
    if (error) throw error;
  },

  updateRecordStatus: async (id: string, status: 'reviewed', corrections: Record<string, string>) => {
    const { error } = await supabase
      .from('ocr_records')
      .update({ status, corrections })
      .eq('id', id);
    
    if (error) throw error;
  },

  getSamples: async (): Promise<TrainingSample[]> => {
    const { data, error } = await supabase
      .from('training_samples')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);
    
    if (error) {
      console.error('Fetch samples error:', error);
      return [];
    }
    return data as TrainingSample[];
  },

  addSample: async (sample: TrainingSample, recordId?: string) => {
    const { error } = await supabase
      .from('training_samples')
      .insert([{
        record_id: recordId,
        corrections: sample.corrections,
        accuracy: sample.accuracy
      }]);
    
    if (error) throw error;
  },

  getROIs: async (): Promise<ROIConfig> => {
    const { data, error } = await supabase
      .from('roi_configs')
      .select('data')
      .eq('is_active', true)
      .limit(1)
      .single();
    
    if (error || !data) {
      console.warn('Using initial ROIs as fallback');
      return INITIAL_ROIS;
    }
    return data.data as ROIConfig;
  },

  updateROIs: async (config: ROIConfig) => {
    const { error } = await supabase
      .from('roi_configs')
      .update({ data: config })
      .eq('is_active', true);
    
    if (error) throw error;
  }
};
