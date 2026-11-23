import { readonly, shallowRef } from 'vue';

export type ApiAvailability = 'offline' | 'unreachable' | 'serverUnavailable' | 'requestTimeout';
const failure = shallowRef<ApiAvailability | null>(null);
export const apiAvailability = readonly(failure);
export const reportApiAvailability = (status: ApiAvailability | null) => {
  failure.value = status;
};
