import test from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';
import fs from 'node:fs';
import Module, { createRequire } from 'node:module';
import path from 'node:path';
function load(name, api = '') {
  process.env.NEXT_PUBLIC_API_BASE_URL = api;
  const filename = path.resolve('src/data', name + '.ts');
  const mod = new Module(filename);
  mod.filename = filename;
  mod.paths = Module._nodeModulePaths(path.dirname(filename));
  mod.require = id => id === './environmental' ? load('environmental', api) : createRequire(filename)(id);
  mod._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'), {compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022}}).outputText, filename);
  return mod.exports;
}
const e = load('environmental');
test('real zero, missing values and São Paulo time remain distinct', () => {
  assert.equal(e.environmentalNumber(0,'pt'),'0');
  assert.equal(e.environmentalNumber(null,'pt'),null);
  assert.equal(e.environmentalNumber(NaN,'en'),null);
  assert.equal(e.environmentalTime('invalid','pt'),null);
  assert.match(e.environmentalTime('2026-07-23T18:30:00Z','pt'), /15:30/);
});
test('date filtering includes full UTC end date, ignores invalid observations and sorts', () => {
  const values = ['2026-07-24T00:00:00Z','bad','2026-07-23T23:59:59Z','2026-07-23T00:00:00Z'].map((observed_at,i)=>({event_id:String(i),observed_at}));
  assert.deepEqual(e.filterEnvironmentalEvents(values,'2026-07-23','2026-07-23').map(v=>v.event_id),['3','2']);
  assert.throws(()=>e.filterEnvironmentalEvents(values,'bad'));
});
test('citation and reference URLs reject signatures, foreign origins and path traversal', () => {
  const s = load('source');
  for (const value of ['javascript:alert(1)','https://a.test/?token=secret','https://user:password@a.test']) assert.equal(e.safeSourceUrl(value),null);
  for (const value of ['/api/v1/areas/a/references/../private','https://evil.test/a.geojson','/api/v1/areas/a/references/x.geojson?token=secret']) assert.throws(()=>s.referenceArtifactUrl(value));
  assert.equal(s.referenceArtifactUrl('/api/v1/areas/a/references/x.geojson'),'/data/api/v1/areas/a/references/x.geojson');
});
test('API pagination, encoding and abort signal are preserved', async () => {
  const s = load('source', 'http://localhost:8000'); const calls=[]; const controller=new AbortController();
  global.fetch = async (url, options) => {calls.push({url,options});return Response.json({items:[{event_id:'x', observed_at:'2026-07-23T00:00:00Z', source_id:'synthetic', quality_status:'valid', kind:'station_measurement', synthetic:true}],total:1});};
  await s.listEnvironmentalEvents('a/b','2026-07-23','2026-07-23',controller.signal);
  assert.match(calls[0].url,/areas\/a%2Fb\/environmental-events\?start=2026-07-23/);
  assert.equal(calls[0].options.signal,controller.signal);
});
test('static endpoints have no query, filter locally and errors do not become demo data', async () => {
  const s = load('source'); const urls=[];
  global.fetch = async url => {urls.push(url);return Response.json({items:[{event_id:'x',observed_at:'2026-07-24T00:00:00Z', source_id:'synthetic', quality_status:'valid', kind:'station_measurement', synthetic:true}],total:1});};
  assert.deepEqual(await s.listEnvironmentalEvents('a','2026-07-23','2026-07-23'),[]);
  assert.equal(urls[0],'/data/api/v1/areas/a/environmental-events.json');
  global.fetch=async()=>new Response('',{status:404});
  await assert.rejects(s.getEnvironmentalContext('a'), error=>error instanceof s.DataSourceError && error.status===404);
  global.fetch=async()=>new Response('',{status:503});
  await assert.rejects(s.getEnvironmentalContext('a'), error=>error.status===503);
  global.fetch=async()=>new Response('broken');
  await assert.rejects(s.getEnvironmentalContext('a'), error=>error.status===503);
  global.fetch=async()=>Response.json({analysis_id:'other'});
  await assert.rejects(s.getEnvironmentalContext('a'), error=>error.status===503);
});
test('abort is preserved rather than reported as missing data', async () => {
  const s=load('source'); const controller=new AbortController(); controller.abort();
  global.fetch=async()=>{throw new DOMException('Aborted','AbortError');};
  await assert.rejects(s.getEnvironmentalContext('a',controller.signal),error=>error.name==='AbortError');
});
test('nested malformed reports fail before rendering', () => {
  const value = JSON.parse(fs.readFileSync('tests/fixtures/environmental-context.synthetic.json', 'utf8'));
  assert.equal(e.assertEnvironmentalReport(value, value.analysis_id), value);
  for (const field of ['rainfall', 'hydrology', 'historical_water', 'land_cover', 'topography']) {
    const broken = structuredClone(value); broken[field].limitations = null;
    assert.throws(() => e.assertEnvironmentalReport(broken, broken.analysis_id));
  }
  const broken = structuredClone(value); broken.hydrology.records[0].observed_at = 'not-a-date';
  assert.throws(() => e.assertEnvironmentalReport(broken, broken.analysis_id));
});
test('unmeasured and measured candidate areas retain null and real zero in timeline', () => {
  const source = fs.readFileSync('src/data/region.ts','utf8');
  const filename = path.resolve('src/data/region.ts');
  const mod = new Module(filename); mod.filename = filename;
  mod.require = id => id === './source' ? {} : createRequire(filename)(id);
  mod.paths = Module._nodeModulePaths(path.dirname(filename));
  // Resolve runtime siblings through the same TypeScript loader.
  mod.require = id => id === './source' ? {} : id.startsWith('./') ? load(id.slice(2)) : createRequire(filename)(id);
  mod._compile(ts.transpileModule(source, {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,filename);
  const scenes=[{start_time:'2026-07-11T00:00:00Z'},{start_time:'2026-07-23T00:00:00Z'}];
  const a={analysis_id:'a',scenes,synthetic:false,evidence:{synthetic:false},artifacts:{},provenance:{},statistics:{candidate_area_km2:0,valid_area_km2:2}};
  const result=mod.exports.buildTimeline([], [a]);
  assert.equal(result.steps[0].analysis.candidateAreaKm2,0);
  assert.equal(result.steps[0].analysis.validAreaKm2,2);
  a.statistics={};
  assert.equal(mod.exports.buildTimeline([], [a]).steps[0].analysis.candidateAreaKm2,null);
});
test('object-valued display fields become recoverable data errors', async () => {
  const value = JSON.parse(fs.readFileSync('tests/fixtures/environmental-context.synthetic.json','utf8'));
  for (const [block,key] of [['historical_water','reference_year'],['historical_water','collection'],['rainfall','run']]) {
    const broken=structuredClone(value); broken[block][key]={bad:'value'};
    assert.throws(()=>e.assertEnvironmentalReport(broken,broken.analysis_id));
  }
  const s=load('source');
  global.fetch=async()=>Response.json({area_id:'a',items:[{title:{bad:'value'}}]});
  await assert.rejects(s.listReferenceLayers('a'),error=>error.status===503);
  global.fetch=async()=>Response.json({items:[{name:{bad:'value'}}],total:1});
  await assert.rejects(s.listContextSources(),error=>error.status===503);
});
test('environmental timeline markers aggregate by UTC day and kind without altering comparisons', () => {
  const values = [
    {event_id:'1',kind:'station_measurement',observed_at:'2026-07-23T10:00:00Z'},
    {event_id:'2',kind:'station_measurement',observed_at:'2026-07-23T15:00:00Z'},
    {event_id:'3',kind:'rainfall_window',observed_at:'2026-07-23T16:00:00Z',observed_start:'2026-07-22T16:00:00Z'},
    {event_id:'bad',kind:'reference',observed_at:'invalid'},
  ];
  const original=structuredClone(values);
  const markers=e.environmentalMarkers(values,'2026-07-01T00:00:00Z','2026-08-01T00:00:00Z');
  assert.equal(markers.length,2);
  assert.equal(markers.find(m=>m.kind==='station_measurement').count,2);
  const rain=markers.find(m=>m.kind==='rainfall_window');
  assert.ok(rain.endPercent>rain.startPercent);
  assert.deepEqual(values,original);
});
