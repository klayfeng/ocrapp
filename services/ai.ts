
import { ROIConfig, OCRResult, TrainingSample, AIModelConfig } from "../types";
import { StorageService } from "./storage";

/**
 * 核心识别逻辑：对接自定义 AI 大模型
 * 修复说明：
 * 1. 增加了对 <think> 标签的正则过滤。
 * 2. 增加了基于字符定位的 JSON 块提取逻辑，防止非 JSON 字符干扰。
 */
export async function processContract(
  imageBytes: string,
  roiConfig: ROIConfig,
  samples: TrainingSample[] = []
): Promise<OCRResult> {
  const startTs = Date.now();
  const config = await StorageService.getModelConfig();

  const fieldDescriptions = Object.entries(roiConfig.fields)
    .map(([key, info]) => `- ${key} (${info.label}): 区域坐标比例 [${info.coords.join(', ')}]`)
    .join('\n');

  const trainingContext = samples.length > 0 
    ? `【近期人工核验纠错参考】:\n${samples.slice(-3).map(s => JSON.stringify(s.corrections)).join('\n')}`
    : "";

  const systemPrompt = `你是一个专业的合同 OCR 数据结构化专家。
任务：从提供的合同样本图片（Base64 格式）中，根据给定的坐标区域提取文字。
字段要求：
${fieldDescriptions}
${trainingContext}

输出要求：
1. 必须且只能输出合法的 JSON 字符串。
2. 严禁包含任何 Markdown 格式标签（如 \`\`\`json）。
3. 严禁包含任何解释性文字、开场白或结尾语。
4. 质量评估 quality 包含 ok, metrics(blur_var, brightness_mean, dark_ratio), warnings。
5. 提取字段存储在 fields 对象中，每个字段包含 value(提取值), conf(置信度0-1), raw(原始文本)。
6. 如果某区域模糊或无内容，value 为空，raw 说明原因。

JSON 结构示例：
{
  "quality": {"ok": true, "metrics": {"blur_var": 500, "brightness_mean": 180, "dark_ratio": 0.01}, "warnings": []},
  "fields": { "agreement_no": {"value": "ABC123", "conf": 0.99, "raw": "合同编号：ABC123"} },
  "warnings": []
}`;

  const callCustomAI = async (mode: string) => {
    const baseUrl = config.url.endsWith('/') ? config.url.slice(0, -1) : config.url;
    const fullUrl = baseUrl.includes('/chat/completions') ? baseUrl : `${baseUrl}/chat/completions`;

    const response = await fetch(fullUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.api_key}`
      },
      body: JSON.stringify({
        model: config.model_name,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: [
            { type: 'text', text: `请使用【${mode}】解析该合同图片。注意严格按照字段坐标提取。` },
            { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${imageBytes}` } }
          ]}
        ],
        temperature: 0.1
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`AI 服务异常 (${response.status}): ${errText.slice(0, 100)}`);
    }

    const data = await response.json();
    let rawContent = data.choices?.[0]?.message?.content || '{}';
    
    // 1. 过滤掉思维链内容 (如 <think>...</think>)
    rawContent = rawContent.replace(/<think>[\s\S]*?<\/think>/g, '');

    // 2. 提取第一个 '{' 到最后一个 '}' 之间的内容，过滤掉前后可能存在的杂质文字
    const jsonStart = rawContent.indexOf('{');
    const jsonEnd = rawContent.lastIndexOf('}');
    
    if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
      rawContent = rawContent.substring(jsonStart, jsonEnd + 1);
    }
    
    // 3. 移除常见的 Markdown 代码块标记
    const cleanJson = rawContent
      .replace(/```json\n?|```/g, '')
      .trim();
      
    try {
      return JSON.parse(cleanJson);
    } catch (e) {
      console.error("AI 响应清洗后解析失败，原始内容:", rawContent);
      throw new Error("AI 响应格式不兼容，未能解析为有效的 JSON。请确保模型能够输出纯 JSON 格式。");
    }
  };

  try {
    const [jsonA, jsonB] = await Promise.all([
      callCustomAI("快速扫描模式"),
      callCustomAI("高精度核准模式")
    ]);

    return {
      ok: true,
      used_image: 'raw',
      quality: jsonB.quality || jsonA.quality || { ok: true, metrics: { blur_var: 0, brightness_mean: 0, dark_ratio: 0 }, warnings: [] },
      primaryFields: jsonA.fields || {},
      secondaryFields: jsonB.fields || {},
      warnings: [...(jsonA.warnings || []), ...(jsonB.warnings || [])],
      latency_ms: Date.now() - startTs
    };
  } catch (e: any) {
    console.error("OCR 处理链路异常:", e);
    throw new Error(e.message || "大模型处理失败，请稍后重试");
  }
}
