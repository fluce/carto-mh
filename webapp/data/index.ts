import { loadLocations } from './locations.ts';
import { loadGuildes } from './guildes.ts';
import { loadViewData } from './view.ts';
import { loadTrolls } from './trolls.ts';

export { queryMonsters } from './monsters.ts';
export { getIndex, updateIndex } from './indexCore.ts';

export async function load(): Promise<void> {
    await loadLocations();
    const guildNames = await loadGuildes();
    await loadTrolls(guildNames);
    await loadViewData();
}