import { isCoreTag } from './core-tags';
describe('Indonesian default tag protections', () => {
  it.each(['Keinginan', 'Kebutuhan', 'Prioritas', ' prioritas ', 'KEBUTUHAN'])('protects %s', (name) => {
    expect(isCoreTag(name)).toBe(true);
  });
  it.each(['Keluarga', 'Langganan', 'Patungan', 'Keinginan Baru'])('allows custom tag %s', (name) => {
    expect(isCoreTag(name)).toBe(false);
  });
});
