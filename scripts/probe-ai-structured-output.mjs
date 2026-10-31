const apiKey = String(process.env.DEEPINFRA_API_KEY ?? '').trim();
if (!apiKey) throw new Error('Set DEEPINFRA_API_KEY in the local process environment to run this probe.');

const model = String(process.env.AI_MODEL ?? 'zai-org/GLM-5.3-Flash').trim();
const iterations = 4;
const schema = Object.freeze({
  type: 'object',
  additionalProperties: false,
  required: ['operation', 'answer', 'items'],
  properties: Object.freeze({
    operation: Object.freeze({ type: 'string', enum: Object.freeze(['probe-operation']) }),
    answer: Object.freeze({ type: 'string' }),
    items: Object.freeze({ type: 'array', items: Object.freeze({ type: 'string' }) }),
  }),
});

function adheres(value) {
  return value && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).sort().join(',') === 'answer,items,operation'
    && value.operation === 'probe-operation'
    && typeof value.answer === 'string'
    && Array.isArray(value.items)
    && value.items.every((item) => typeof item === 'string');
}

async function probe(mode, index) {
  const request = {
    model,
    messages: [
      { role: 'system', content: 'Return only the requested structured result. The operation must be probe-operation.' },
      { role: 'user', content: `Probe ${index}: return a short answer and one item.` },
    ],
    max_tokens: 120,
    temperature: 0,
    top_p: 1,
    reasoning_effort: 'low',
  };
  if (mode === 'json-schema') {
    request.response_format = { type: 'json_schema', json_schema: { name: 'ycoders_probe', strict: true, schema } };
  } else {
    request.tools = [{ type: 'function', function: { name: 'emit_probe', description: 'Emit the probe result.', parameters: schema, strict: true } }];
    request.tool_choice = { type: 'function', function: { name: 'emit_probe' } };
  }

  const response = await fetch('https://api.deepinfra.com/v1/openai/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  if (!response.ok) return Object.freeze({ accepted: false, status: response.status });
  const payload = await response.json();
  const choice = payload?.choices?.[0];
  let value;
  try {
    value = JSON.parse(mode === 'json-schema'
      ? choice?.message?.content
      : choice?.message?.tool_calls?.[0]?.function?.arguments);
  } catch { value = null; }
  return Object.freeze({
    accepted: true,
    status: response.status,
    finishReason: typeof choice?.finish_reason === 'string' ? choice.finish_reason : 'unknown',
    jsonValid: value !== null,
    schemaAdherent: adheres(value),
    operationAdherent: value?.operation === 'probe-operation',
    requiredFieldsAdherent: typeof value?.answer === 'string' && Array.isArray(value?.items),
  });
}

const report = { model, iterations, modes: {} };
for (const mode of ['json-schema', 'required-tool']) {
  report.modes[mode] = [];
  for (let index = 1; index <= iterations; index += 1) report.modes[mode].push(await probe(mode, index));
}
console.log(JSON.stringify(report, null, 2));
