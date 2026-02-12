
import { ROIConfig, OCRResult, TrainingSample, AIModelConfig } from "../types";
import { StorageService } from "./storage";

/**
 * 核心识别逻辑：对接自定义 AI 大模型
 */
export async function processContract(
  imageInput: string, // 兼容 URL 或 Base64
  roiConfig: ROIConfig,
  samples: TrainingSample[] = []
): Promise<OCRResult> {
  const startTs = Date.now();
  const config = await StorageService.getModelConfig();

  // 构造字段映射表，用于后期容错
  const labelToKeyMap: Record<string, string> = {};
  const fieldEntries = Object.entries(roiConfig.fields).map(([key, info]) => {
    labelToKeyMap[info.label] = key;
    return `${key} (${info.label})`;
  });

  const trainingContext = samples.length > 0 
    ? `参考以往纠错示例：\n${samples.slice(-2).map(s => JSON.stringify(s.corrections)).join('\n')}`
    : "";

  // 1. 极其精简的 System Prompt，只负责定义格式和字段
  const systemPrompt = `你是一个专业的合同 OCR 结构化专家。
任务：解析用户上传的图片，并严格输出 JSON。

字段列表（Key及对应名称）：
${fieldEntries.join('\n')}

${trainingContext}

输出要求：
1. 必须输出合法 JSON，包含 quality、fields 和 warnings 三个根对象。
2. fields 必须包含上述所有 Key。每个字段结构：{"value": "提取文本", "conf": 0.9, "raw": "原始文字"}。
3. 严禁输出任何 Markdown 标签、<think> 标签或解释性文字。
4. 如果图片模糊，请在 quality.warnings 中注明，但必须尝试提取。`;

  // 判断输入是 URL 还是 Base64
  const isUrl = imageInput.startsWith('http');
  
  // 关键修正：添加 detail: 'auto'，这对于很多模型适配器识别 Base64 至关重要
  const imageUrlObj = isUrl 
    ? { 
        url: imageInput,
        detail: 'auto' 
      } 
    : { 
        url: `data:image/jpeg;base64,${imageInput.trim()}`,
        detail: 'auto'
      };

  const callCustomAI = async (mode: string) => {
    // 确保 URL 处理逻辑健壮，适配火山引擎等标准 OpenAI 接口
    let baseUrl = config.url.trim();
    if (baseUrl.endsWith('/')) {
        baseUrl = baseUrl.slice(0, -1);
    }
    
    // 强制修正：检测到用户可能误填了 /responses (这是非兼容接口)，或者 /api/v3/responses
    // 我们的代码发送的是 OpenAI 格式的 messages，必须对接 /chat/completions
    if (baseUrl.endsWith('/responses')) {
        console.warn(`[AI Config Fix] Converting incompatible endpoint '${baseUrl}' to OpenAI-compatible '/chat/completions'`);
        baseUrl = baseUrl.replace(/\/responses$/, '/chat/completions');
    }

    // 自动补全 /chat/completions (如果 URL 不是以它结尾)
    // 确保最终 URL 是 https://.../chat/completions
    let fullUrl = baseUrl;
    if (!baseUrl.endsWith('/chat/completions')) {
       fullUrl = `${baseUrl}/chat/completions`;
    }

    console.log(`[AI] Calling Endpoint: ${fullUrl} | Model: ${config.model_name}`);

    // 2. 优化请求体
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
            { 
              type: 'text', 
              text: `请注意：我已经上传了合同图片（${isUrl ? '云端链接' : 'Base64流'}），请执行【${mode}】。请直接返回 JSON 识别结果，不要回复除 JSON 以外的任何内容。` 
            },
            { 
              type: 'image_url', 
              image_url: imageUrlObj
            }
          ]}
        ],
        temperature: 0.1,
        max_tokens: 4096
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      let detailedMsg = '';
      try {
        const jsonErr = JSON.parse(errText);
        // 尝试提取常见的错误字段
        if (jsonErr.error && jsonErr.error.message) {
            detailedMsg = jsonErr.error.message;
        } else if (jsonErr.message) {
            detailedMsg = jsonErr.message;
        } else {
            detailedMsg = JSON.stringify(jsonErr);
        }
      } catch (e) {
          detailedMsg = errText.slice(0, 200);
      }
      
      console.error(`[AI Error] Status: ${response.status} | Body: ${detailedMsg}`);
      throw new Error(`AI 请求失败 (${response.status}): ${detailedMsg} (URL: ${fullUrl})`);
    }

    const data = await response.json();
    let content = data.choices?.[0]?.message?.content || '';

    // 3. 强化清洗逻辑
    content = content.replace(/<think>[\s\S]*?<\/think>/g, '');
    content = content.replace(/```json|```/gi, '').trim();

    const start = content.indexOf('{');
    const end = content.lastIndexOf('}');
    
    if (start === -1 || end === -1) {
      console.error("模型原始响应:", content);
      throw new Error("模型未按预期返回 JSON 格式，请检查模型 Vision 能力。");
    }
    
    const jsonStr = content.substring(start, end + 1);

    try {
      const parsed = JSON.parse(jsonStr);
      
      // 字段 Key 自动校正映射
      if (parsed.fields) {
        const correctedFields: any = {};
        const expectedKeys = Object.keys(roiConfig.fields);
        
        Object.keys(parsed.fields).forEach(aiKey => {
          if (expectedKeys.includes(aiKey)) {
            correctedFields[aiKey] = parsed.fields[aiKey];
          } else if (labelToKeyMap[aiKey]) {
            correctedFields[labelToKeyMap[aiKey]] = parsed.fields[aiKey];
          }
        });

        // 补全缺失项
        expectedKeys.forEach(k => {
          if (!correctedFields[k]) {
            correctedFields[k] = { value: "", conf: 0, raw: "未检出" };
          }
        });

        parsed.fields = correctedFields;
      }
      
      return parsed;
    } catch (e) {
      console.error("JSON Parse Error:", e, "Raw Content:", content);
      throw new Error("AI 返回了非法的 JSON 格式");
    }
  };

  try {
    // 采用双路并发，提高鲁棒性
    const [jsonA, jsonB] = await Promise.all([
      callCustomAI("常规扫描"),
      callCustomAI("精度校验")
    ]);

    return {
      ok: true,
      used_image: isUrl ? 'aligned' : 'raw', // 标记使用云端图
      quality: jsonB.quality || jsonA.quality || { ok: true, metrics: { blur_var: 0, brightness_mean: 0, dark_ratio: 0 }, warnings: [] },
      primaryFields: jsonA.fields || {},
      secondaryFields: jsonB.fields || {},
      warnings: [...(jsonA.warnings || []), ...(jsonB.warnings || [])],
      latency_ms: Date.now() - startTs
    };
  } catch (e: any) {
    console.error("OCR Trace:", e);
    throw new Error(e.message || "识别链路异常");
  }
}
