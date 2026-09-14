import { loadData } from './loadData.mjs';
import { index } from './parse.mjs';

console.log('Worker script loaded');

self.onmessage = async event => {
    if (event.data?.type !== 'load') return;
    try {
        console.log('Loading data in worker');
        const data = await loadData(['lieux'], 'Raccourcis', 'TGV', 'all');
        console.log('Data loaded in worker:', data);
        self.postMessage({ data, index: index.serialize() });
    } catch (error) {
        self.postMessage({ error: error instanceof Error ? error.message : String(error) });
    }
};

self.postMessage({ type: 'ready' });