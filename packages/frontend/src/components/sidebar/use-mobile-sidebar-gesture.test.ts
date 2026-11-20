import { shouldOpenMobileSidebar } from './use-mobile-sidebar-gesture';

describe('mobile sidebar gesture', () => {
  it('settles by distance when the touch comes to rest', () => {
    expect(shouldOpenMobileSidebar({ progress: 0.2, velocity: 0, wasOpen: false })).toBe(false);
    expect(shouldOpenMobileSidebar({ progress: 0.5, velocity: 0, wasOpen: false })).toBe(true);
    expect(shouldOpenMobileSidebar({ progress: 0.8, velocity: 0, wasOpen: true })).toBe(true);
    expect(shouldOpenMobileSidebar({ progress: 0.5, velocity: 0, wasOpen: true })).toBe(false);
  });

  it('respects a flick in either direction', () => {
    expect(shouldOpenMobileSidebar({ progress: 0.2, velocity: 0.65, wasOpen: false })).toBe(true);
    expect(shouldOpenMobileSidebar({ progress: 0.8, velocity: -0.65, wasOpen: true })).toBe(false);
  });
});
