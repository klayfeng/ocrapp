
import { GoogleGenAI, Type } from "@google/genai";
import { ROIConfig, OCRResult, TrainingSample, FieldResult } from "../types";

export async function processContract(
  imageBytes: string,
  roiConfig: ROIConfig,
  samples: TrainingSample[] = []
): Promise<OCRResult> {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
  const startTs = Date.now();

  const fieldDescriptions = Object.entries(roiConfig.fields)
    .map(([key, info]) => `- ${key} (${info.label}): 区域坐标比例 [${info.coords.join(', ')}]`)
    .join('\n');

  const trainingContext = samples.length > 0 
    ? `【学习模式开启】参考以往纠错：\n${samples.slice(-5).map(s => `错误纠正: ${JSON.stringify(s.corrections)}`).join('\n')}`
    : "";

  // 共享的识别 Prompt 逻辑
  const getPrompt = (role: string) => `
    你是一个${role}。
    ${trainingContext}
    任务：从合同图片中提取以下字段，必须严格匹配提供的坐标区域。
    ${fieldDescriptions}
    要求：
    1. 返回 JSON。
    2. 金额必须为纯数字字符串。
    3. 日期格式 YYYY-MM-DD。
    4. 若看不清，请在 raw 字段描述原因，并在 value 留空。
  `;

  const schema = {
    type: Type.OBJECT,
    properties: {
      quality: {
        type: Type.OBJECT,
        properties: {
          ok: { type: Type.BOOLEAN },
          metrics: {
            type: Type.OBJECT,
            properties: {
              blur_var: { type: Type.NUMBER },
              brightness_mean: { type: Type.NUMBER },
              dark_ratio: { type: Type.NUMBER }
            },
            required: ["blur_var", "brightness_mean", "dark_ratio"]
          },
          warnings: { type: Type.ARRAY, items: { type: Type.STRING } }
        },
        required: ["ok", "metrics", "warnings"]
      },
      fields: {
        type: Type.OBJECT,
        properties: Object.keys(roiConfig.fields).reduce((acc, key) => {
          acc[key] = {
            type: Type.OBJECT,
            properties: {
              value: { type: Type.STRING },
              conf: { type: Type.NUMBER },
              raw: { type: Type.STRING }
            },
            required: ["value", "conf", "raw"]
          };
          return acc;
        }, {} as any)
      },
      warnings: { type: Type.ARRAY, items: { type: Type.STRING } }
    },
    required: ["quality", "fields", "warnings"]
  };

  // 并行启动两个引擎：Flash (速度) 和 Pro (模拟 GLM-OCR 的高精度)
  const [resA, resB] = await Promise.all([
    ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: [{ parts: [{ text: getPrompt("快速识别助手") }, { inlineData: { mimeType: 'image/jpeg', data: imageBytes } }] }],
      config: { responseMimeType: "application/json", responseSchema: schema }
    }),
    ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: [{ parts: [{ text: getPrompt("深度审计专家（专注于笔迹识别与逻辑校验）") }, { inlineData: { mimeType: 'image/jpeg', data: imageBytes } }] }],
      config: { responseMimeType: "application/json", responseSchema: schema }
    })
  ]);

  const jsonA = JSON.parse(resA.text || '{}');
  const jsonB = JSON.parse(resB.text || '{}');

  return {
    ok: true,
    used_image: 'raw',
    quality: jsonB.quality, // 以 Pro 引擎的质量评估为准
    primaryFields: jsonA.fields,
    secondaryFields: jsonB.fields,
    warnings: [...(jsonA.warnings || []), ...(jsonB.warnings || [])],
    latency_ms: Date.now() - startTs
  };
}
