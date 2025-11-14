import { LoadingManager } from 'three';

export function manager() {
    const LoadingManager = new LoadingManager();
    LoadingManager.onLoad = function () {
        console.log('loaded!');
    }
    return LoadingManager;
}
