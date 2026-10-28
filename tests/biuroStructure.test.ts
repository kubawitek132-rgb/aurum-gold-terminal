import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BIURO_FLOORS, BIURO_STRUCTURE, getFloorInventory, summarizeInventory } from '../src/lib/biuroStructure';

test('building inventory preserves exact installed and interface rosters without duplicate roles', () => {
  assert.deepEqual(BIURO_FLOORS.map(floor => floor.id), ['aurum', 'coin', 'hq']);
  const ids = new Set<string>();
  const sources = new Set(BIURO_STRUCTURE.sources.map(source => source.id));
  for (const floor of BIURO_FLOORS) {
    const roles = floor.departments.flatMap(department => department.stations);
    assert.equal(roles.length, floor.counts.stations ?? 0);
    for (const role of roles) {
      assert.ok(!ids.has(role.id), `Duplicate station ${role.id}`);
      ids.add(role.id);
      assert.ok(sources.has(role.sourceId as typeof BIURO_STRUCTURE.sources[number]['id']));
    }
  }
  assert.equal(ids.size, 73);
  assert.equal(getFloorInventory('aurum')?.counts.stations, 61);
  assert.equal(getFloorInventory('aurum')?.counts.officeSections, 6);
  assert.equal(getFloorInventory('aurum')?.counts.operationalDepartments, 16);
  assert.equal(getFloorInventory('coin')?.counts.stations, 12);
  assert.equal(getFloorInventory('hq')?.counts.stations, null);
  assert.equal(getFloorInventory('lab'), undefined);
  assert.deepEqual(summarizeInventory(), { knownStations: 73, installedStations: 61, configuredStations: 12, unknownFloors: 1, complete: false });
});

test('research belongs to AURUM, staged FIEDIA is excluded and unknown HQ is not zero staff', () => {
  const roles = getFloorInventory('aurum')!.departments.flatMap(department => department.stations);
  assert.ok(roles.some(role => role.name === 'SASZA'));
  assert.equal(roles.some(role => /FIEDIA/i.test(role.name)), false);
  assert.ok(roles.every(role => role.installation === 'installed'));
  const hq = getFloorInventory('hq')!;
  assert.equal(hq.sourceStatus, 'unknown');
  assert.equal(hq.counts.groups, null);
  assert.ok(hq.notes.length);
});
