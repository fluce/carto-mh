import { loadLocations } from './load-lieux.mjs';
import { loadTrolls } from './load-trolls.mjs';
import { loadView } from './load.mjs';
import { loadInventory } from './load-inventory.mjs';

await loadLocations();
await loadTrolls();
await loadView();
await loadInventory();