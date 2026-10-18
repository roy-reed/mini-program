// Dependency-free checks for this planning package. Not an application test suite.
// The schema evaluator intentionally supports only the keywords used here;
// P02 must also run a maintained OpenAPI/JSON Schema validator after installing dependencies.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = file => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
const api = read('specs/openapi.json');
const configSchema = read('specs/campaign.schema.json');
const config = read('specs/campaign.example.json');
const examples = read('specs/api-examples.json');
const cases = read('specs/acceptance-cases.json');

function resolve(doc, pointer) {
  assert.ok(pointer.startsWith('#/'), `External reference not supported: ${pointer}`);
  let value = doc;
  for (const raw of pointer.slice(2).split('/')) {
    const key = raw.replaceAll('~1', '/').replaceAll('~0', '~');
    assert.ok(value && Object.hasOwn(value, key), `Unresolved reference: ${pointer}`);
    value = value[key];
  }
  return value;
}

function walk(value, fn) {
  if (!value || typeof value !== 'object') return;
  fn(value);
  for (const child of Object.values(value)) walk(child, fn);
}

function matchesType(value, type) {
  if (type === 'null') return value === null;
  if (type === 'array') return Array.isArray(value);
  if (type === 'object') return value !== null && typeof value === 'object' && !Array.isArray(value);
  if (type === 'integer') return typeof value === 'number' && Number.isInteger(value);
  if (type === 'number') return typeof value === 'number' && Number.isFinite(value);
  return typeof value === type;
}

function validate(schema, value, doc, at = '$') {
  if (schema.$ref) return validate(resolve(doc, schema.$ref), value, doc, at);
  if (schema.anyOf) {
    assert.ok(schema.anyOf.some(option => {
      try { validate(option, value, doc, at); return true; } catch { return false; }
    }), `${at}: no anyOf branch matched`);
    return;
  }
  if (Object.hasOwn(schema, 'const')) assert.deepEqual(value, schema.const, `${at}: const`);
  if (schema.enum) assert.ok(schema.enum.some(x => JSON.stringify(x) === JSON.stringify(value)), `${at}: enum`);
  if (schema.type) assert.ok(matchesType(value, schema.type), `${at}: expected ${schema.type}`);
  if (typeof value === 'string') {
    const n = [...value].length;
    if (schema.minLength !== undefined) assert.ok(n >= schema.minLength, `${at}: minLength`);
    if (schema.maxLength !== undefined) assert.ok(n <= schema.maxLength, `${at}: maxLength`);
    if (schema.pattern) assert.match(value, new RegExp(schema.pattern, 'u'), `${at}: pattern`);
    if (schema.format === 'uuid') assert.match(value, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, `${at}: uuid`);
    if (schema.format === 'date-time') {
      assert.match(value, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/, `${at}: timezone required`);
      assert.ok(Number.isFinite(Date.parse(value)), `${at}: date-time`);
    }
    if (schema.format === 'uri') assert.ok(new URL(value).protocol, `${at}: uri`);
  }
  if (typeof value === 'number') {
    if (schema.minimum !== undefined) assert.ok(value >= schema.minimum, `${at}: minimum`);
    if (schema.maximum !== undefined) assert.ok(value <= schema.maximum, `${at}: maximum`);
  }
  if (Array.isArray(value)) {
    if (schema.minItems !== undefined) assert.ok(value.length >= schema.minItems, `${at}: minItems`);
    if (schema.maxItems !== undefined) assert.ok(value.length <= schema.maxItems, `${at}: maxItems`);
    if (schema.uniqueItems) assert.equal(new Set(value.map(x => JSON.stringify(x))).size, value.length, `${at}: uniqueItems`);
    if (schema.items) value.forEach((x, i) => validate(schema.items, x, doc, `${at}[${i}]`));
  }
  if (matchesType(value, 'object')) {
    if (schema.minProperties !== undefined) assert.ok(Object.keys(value).length >= schema.minProperties, `${at}: minProperties`);
    for (const key of schema.required ?? []) assert.ok(Object.hasOwn(value, key), `${at}.${key}: required`);
    for (const [key, item] of Object.entries(value)) {
      if (schema.properties?.[key]) validate(schema.properties[key], item, doc, `${at}.${key}`);
      else if (schema.additionalProperties === false) assert.fail(`${at}.${key}: additional property`);
      else if (typeof schema.additionalProperties === 'object') validate(schema.additionalProperties, item, doc, `${at}.${key}`);
    }
  }
}

const supported = new Set(['$schema', '$ref', 'title', 'description', 'type', 'properties', 'required', 'additionalProperties', 'minProperties', 'const', 'enum', 'anyOf', 'minLength', 'maxLength', 'pattern', 'format', 'minimum', 'maximum', 'default', 'items', 'minItems', 'maxItems', 'uniqueItems']);
function checkSchemaKeywords(schema) {
  for (const key of Object.keys(schema)) assert.ok(supported.has(key), `Add validator support for schema keyword: ${key}`);
  for (const child of Object.values(schema.properties ?? {})) checkSchemaKeywords(child);
  if (schema.items) checkSchemaKeywords(schema.items);
  if (typeof schema.additionalProperties === 'object') checkSchemaKeywords(schema.additionalProperties);
  for (const child of schema.anyOf ?? []) checkSchemaKeywords(child);
}
checkSchemaKeywords(configSchema);
for (const schema of Object.values(api.components.schemas)) checkSchemaKeywords(schema);
walk(api, node => { if (node.$ref) resolve(api, node.$ref); });

assert.equal(api.openapi, '3.1.0');
const ids = new Set();
let operations = 0;
for (const [url, methods] of Object.entries(api.paths)) {
  for (const [method, operation] of Object.entries(methods)) {
    assert.ok(['get', 'post', 'patch', 'put', 'delete'].includes(method), `${url}: invalid method`);
    assert.ok(!ids.has(operation.operationId), `Duplicate operationId: ${operation.operationId}`);
    ids.add(operation.operationId); operations++;
    const params = (operation.parameters ?? []).map(x => x.$ref ? resolve(api, x.$ref) : x);
    const names = [...url.matchAll(/{([^}]+)}/g)].map(x => x[1]);
    for (const name of names) assert.ok(params.some(p => p.in === 'path' && p.name === name && p.required), `${url}: path parameter missing`);
    for (const p of params.filter(x => x.in === 'path')) assert.ok(names.includes(p.name), `${url}: extra path parameter`);
    assert.ok(Object.keys(operation.responses).some(x => /^2\d\d$/.test(x)), `${url}: success response missing`);
    const adminWrite = url.startsWith('/admin/') && ['post', 'patch', 'delete'].includes(method) && operation.operationId !== 'adminLogin';
    if (adminWrite) {
      assert.deepEqual(operation.security, [{ adminCookie: [] }]);
      assert.ok(params.some(p => p.name === 'X-CSRF-Token' && p.required), `${url}: CSRF missing`);
    }
    if (url.startsWith('/public/') || url.startsWith('/shares/')) assert.deepEqual(operation.security, []);
    if (operation.operationId === 'drawInvitation') assert.ok(params.some(p => p.name === 'Idempotency-Key' && p.required));
  }
}

validate(configSchema, config, configSchema);
function semanticConfig(c) {
  for (const key of ['audioClips', 'backgrounds', 'layouts', 'variants']) assert.equal(new Set(c[key].map(x => x.id)).size, c[key].length, `${key}: duplicate id`);
  const audios = new Set(c.audioClips.map(x => x.id)), bgs = new Set(c.backgrounds.map(x => x.id)), layouts = new Set(c.layouts.map(x => x.id));
  let weight = 0;
  const combinations = new Set();
  for (const variant of c.variants) {
    assert.ok(audios.has(variant.audioId) && bgs.has(variant.backgroundId) && layouts.has(variant.layoutId), `${variant.id}: missing asset/layout reference`);
    const key = `${variant.audioId}/${variant.backgroundId}/${variant.layoutId}`;
    assert.ok(!combinations.has(key), `${variant.id}: duplicate combination`); combinations.add(key);
    weight += variant.weight;
  }
  assert.ok(Number.isSafeInteger(weight) && weight > 0 && weight <= 2147483647, 'Invalid weight total');
  for (const layout of c.layouts) {
    const b = layout.nameBox;
    assert.ok(b.x + b.width <= c.output.width && b.y + b.height <= c.output.height, 'Name box out of canvas');
    assert.ok(b.minFontSize <= b.fontSize, 'Invalid font size bounds');
  }
  if (c.campaign.startsAt && c.campaign.endsAt) assert.ok(Date.parse(c.campaign.startsAt) < Date.parse(c.campaign.endsAt), 'Invalid activity time range');
}
semanticConfig(config);
assert.equal(config.exampleOnly, true);
assert.equal(config.publication.ready, false);
assert.equal(config.campaign.status, 'draft');
for (const example of examples.examples) validate(resolve(api, `#/components/schemas/${example.schema}`), example.value, api, example.schema);

// Negative checks make sure the checker can detect material drift.
const zeroWeight = structuredClone(config); zeroWeight.variants[0].weight = 0;
assert.throws(() => validate(configSchema, zeroWeight, configSchema));
const brokenRef = structuredClone(config); brokenRef.variants[0].audioId = 'missing-audio';
assert.throws(() => semanticConfig(brokenRef));
const badState = structuredClone(examples.examples.find(x => x.schema === 'Invitation').value);
badState.pendingRevision.status = 'finished';
assert.throws(() => validate(api.components.schemas.Invitation, badState, api));
const leakedUser = { ...examples.examples.find(x => x.schema === 'ShareCreated').value, openid: 'must-not-exist' };
assert.throws(() => validate(api.components.schemas.ShareCreated, leakedUser, api));

const caseIds = new Set();
for (const item of cases.cases) {
  assert.ok(!caseIds.has(item.id), `Duplicate case ${item.id}`); caseIds.add(item.id);
  assert.match(item.taskId, /^P(?:0\d|1[0-5])$/);
  assert.ok(item.given && item.when && item.then.length);
  assert.equal(item.status, 'planned');
  for (const opId of item.operationIds) assert.ok(ids.has(opId), `${item.id}: unknown operation ${opId}`);
}
for (let i = 1; i <= 20; i++) assert.ok(caseIds.has(`A${String(i).padStart(2, '0')}`));

let markdownCount = 0;
function checkMarkdown(dir) {
  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    if (item.name === '.git' || item.name === 'node_modules') continue;
    const file = path.join(dir, item.name);
    if (item.isDirectory()) checkMarkdown(file);
    else if (item.name.endsWith('.md')) {
      markdownCount++;
      const body = fs.readFileSync(file, 'utf8');
      assert.equal((body.match(/^```/gm) ?? []).length % 2, 0, `${file}: unbalanced fences`);
      for (const match of body.matchAll(/!?\[[^\]]*\]\(([^)]+)\)/g)) {
        const link = match[1];
        if (/^[a-z]+:/i.test(link) || link.startsWith('#')) continue;
        assert.ok(fs.existsSync(path.resolve(path.dirname(file), link.split('#')[0])), `${file}: missing link ${link}`);
      }
    }
  }
}
checkMarkdown(root);
console.log(JSON.stringify({ result: 'PASS', scope: 'planning-package only; no app/device/release tests', operations, schemas: Object.keys(api.components.schemas).length, configurationVariants: config.variants.length, schemaExamples: examples.examples.length, negativeChecks: 4, acceptanceCases: cases.cases.length, markdownFiles: markdownCount, examplePublication: 'blocked draft as intended' }, null, 2));
