import { loadLocations } from '../sources/locations.ts';
import { loadGuildes } from '../sources/guildes.ts';
import { loadViewData } from '../sources/view.ts';
import { loadTrolls } from '../sources/trolls.ts';

export { queryMonsters } from '../sources/monsters.ts';
export { getIndex, updateIndex } from './indexCore.ts';

export async function load(): Promise<void> {
    await loadLocations();
    const guildNames = await loadGuildes();
    await loadTrolls(guildNames);
    await loadViewData();
}