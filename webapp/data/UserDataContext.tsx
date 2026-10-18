import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { readUserData, UserDataConflictError, writeUserData } from './DataContext.ts';
import type { UserData, UserDataExtensionValue } from '../shared/types';

export interface UserDataContextValue {
    userData: UserData | null;
    loading: boolean;
    error: string | null;
    setUserData: (data: UserData) => Promise<void>;
    updateUserData: (update: (current: UserData) => UserData) => Promise<void>;
}

export const UserDataContext = createContext<UserDataContextValue | null>(null);

export function UserDataProvider({ children }: { children: ReactNode }) {
    const [userData, setUserDataState] = useState<UserData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const etag = useRef<string | null>(null);
    const dataRef = useRef<UserData | null>(null);
    const initialLoad = useRef<Promise<void> | null>(null);
    const saveQueue = useRef<Promise<void>>(Promise.resolve());

    const ensureLoaded = useCallback(() => {
        if (!initialLoad.current) {
            initialLoad.current = readUserData()
                .then(result => {
                    dataRef.current = result.data;
                    etag.current = result.etag;
                    setUserDataState(result.data);
                })
                .catch(loadError => {
                    initialLoad.current = null;
                    throw loadError;
                });
        }
        return initialLoad.current;
    }, []);

    useEffect(() => {
        let active = true;
        setLoading(true);
        ensureLoaded()
            .catch(loadError => {
                if (active) {
                    setError(loadError instanceof Error ? loadError.message : String(loadError));
                }
            })
            .finally(() => {
                if (active) {
                    setLoading(false);
                }
            });
        return () => {
            active = false;
        };
    }, [ensureLoaded]);

    const persistLatest = useCallback(async () => {
        let value = dataRef.current;
        let currentEtag = etag.current;
        if (currentEtag === null || value === null) {
            throw new Error('User data has not been loaded');
        }

        while (true) {
            try {
                const result = await writeUserData(value, currentEtag);
                etag.current = result.etag;
                setError(null);
                return;
            } catch (saveError) {
                if (!(saveError instanceof UserDataConflictError)) {
                    throw saveError;
                }

                const serverVersion = await readUserData();
                etag.current = serverVersion.etag;
                currentEtag = serverVersion.etag;
                value = reconcileUserData(serverVersion.data, dataRef.current ?? createEmptyUserData());
                dataRef.current = value;
                setUserDataState(value);
            }
        }
    }, []);

    const enqueueSave = useCallback(() => {
        const save = saveQueue.current.catch(() => undefined).then(persistLatest);
        saveQueue.current = save.catch(() => undefined);
        return save;
    }, [persistLatest]);

    const setUserData = useCallback(async (next: UserData) => {
        await ensureLoaded();
        dataRef.current = next;
        setUserDataState(next);
        setError(null);
        try {
            await enqueueSave();
        } catch (saveError) {
            setError(saveError instanceof Error ? saveError.message : String(saveError));
            throw saveError;
        }
    }, [enqueueSave, ensureLoaded]);

    const updateUserData = useCallback(async (update: (current: UserData) => UserData) => {
        await ensureLoaded();
        const next = update(dataRef.current ?? createEmptyUserData());
        dataRef.current = next;
        setUserDataState(next);
        setError(null);
        try {
            await enqueueSave();
        } catch (saveError) {
            setError(saveError instanceof Error ? saveError.message : String(saveError));
            throw saveError;
        }
    }, [enqueueSave, ensureLoaded]);

    const contextValue = useMemo(() => ({
        userData,
        loading,
        error,
        setUserData,
        updateUserData,
    }), [userData, loading, error, setUserData, updateUserData]);

    return <UserDataContext.Provider value={contextValue}>{children}</UserDataContext.Provider>;
}

export function useUserData() {
    const context = useContext(UserDataContext);
    if (!context) {
        throw new Error('useUserData must be used within a UserDataProvider');
    }
    return context;
}

function reconcileUserData(serverData: UserData, localData: UserData): UserData {
    const merged = mergeUserDataObjects(serverData, localData);
    return {
        ...merged,
        friendGuilds: localData.friendGuilds,
        foeGuilds: localData.foeGuilds,
        friendTrolls: localData.friendTrolls,
        foeTrolls: localData.foeTrolls,
    };
}

function mergeUserDataObjects(
    serverData: Record<string, UserDataExtensionValue>,
    localData: Record<string, UserDataExtensionValue>,
): Record<string, UserDataExtensionValue> {
    const keys = new Set([...Object.keys(serverData), ...Object.keys(localData)]);
    return Object.fromEntries([...keys].map(key => [
        key,
        Object.hasOwn(localData, key)
            ? Object.hasOwn(serverData, key)
                ? mergeUserDataValues(serverData[key], localData[key])
                : localData[key]
            : serverData[key],
    ]));
}

function mergeUserDataValues(serverValue: UserDataExtensionValue, localValue: UserDataExtensionValue): UserDataExtensionValue {
    if (!isUserDataObject(serverValue) || !isUserDataObject(localValue)) {
        return localValue;
    }
    return mergeUserDataObjects(serverValue, localValue);
}

function isUserDataObject(value: UserDataExtensionValue): value is { [key: string]: UserDataExtensionValue } {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function createEmptyUserData(): UserData {
    return { friendGuilds: [], foeGuilds: [], friendTrolls: [], foeTrolls: [] };
}
