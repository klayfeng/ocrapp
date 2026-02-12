
import { ROIConfig } from './types';

export const INITIAL_ROIS: ROIConfig = {
  "template_size_hint": [1280, 1759],
  "fields": {
    "agreement_no":     { label: "合同编号", coords: [0.672, 0.030, 0.981, 0.074] },
    "phone":            { label: "联系电话", coords: [0.672, 0.132, 0.981, 0.179] },
    "member_name":      { label: "会员姓名", coords: [0.203, 0.168, 0.438, 0.207] },
    "gender":           { label: "性别", coords: [0.496, 0.168, 0.578, 0.207] },
    "id_no":            { label: "证件号码", coords: [0.258, 0.207, 0.438, 0.245] },
    "price":            { label: "合同单价", coords: [0.195, 0.410, 0.305, 0.517] },
    "receivable":       { label: "应收金额", coords: [0.336, 0.410, 0.477, 0.517] },
    "received":         { label: "实收金额", coords: [0.496, 0.410, 0.594, 0.517] },
    "deposit":          { label: "定金", coords: [0.617, 0.410, 0.703, 0.517] },
    "valid_days":       { label: "有效天数", coords: [0.711, 0.410, 0.813, 0.517] },
    "note":             { label: "备注", coords: [0.813, 0.410, 0.985, 0.517] },
    "card_start_date":  { label: "起效日期", coords: [0.266, 0.556, 0.500, 0.590] },
    "processing_date":  { label: "办理日期", coords: [0.664, 0.637, 0.970, 0.674] }
  }
};

export const DEFAULT_TEMPLATE_URL = "https://picsum.photos/seed/contract/1280/1759";
