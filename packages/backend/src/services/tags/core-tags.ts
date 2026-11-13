/** User-visible starter tags are reserved and cannot be renamed or deleted.
 * Existing tag IDs and transaction references remain unchanged.
 */
export const CORE_TAG_NAMES = new Set(['keinginan', 'kebutuhan', 'prioritas']);
export const isCoreTag = (name: string) => CORE_TAG_NAMES.has(name.trim().toLocaleLowerCase('id-ID'));
