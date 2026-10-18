import { useEffect, useState } from 'react'
import MyThree from '../features/map/Three'
import SidePanel from '../features/panels/SidePanel'
import PathFindingPanel from '../features/pathfinding/PathFindingPanel'
import LoginDialog from '../features/auth/LoginDialog'
import './App.css'
import { DataProvider, useData } from '../data/DataContext.ts';
import { UserDataProvider, useUserData } from '../data/UserDataContext.tsx';
import { PathFindingProvider } from '../features/pathfinding/PathFindingProvider'

function App() {
  return (
    <DataProvider>
      <UserDataProvider>
        <AppContent />
      </UserDataProvider>
    </DataProvider>
  )
}

function AppContent() {
  const { dataReady, needsLogin } = useData();
  const { loading: userDataLoading } = useUserData();
  const [minimumLoadingElapsed, setMinimumLoadingElapsed] = useState(false);
  const [loadingScreenDismissed, setLoadingScreenDismissed] = useState(false);
  const readyToDismiss = dataReady && !userDataLoading && minimumLoadingElapsed && !needsLogin;

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setMinimumLoadingElapsed(true), 3000);
    return () => window.clearTimeout(timeoutId);
  }, []);

  useEffect(() => {
    if (!readyToDismiss) {
      setLoadingScreenDismissed(false);
      return;
    }

    const fadeDuration = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 400;
    const timeoutId = window.setTimeout(() => setLoadingScreenDismissed(true), fadeDuration);
    return () => window.clearTimeout(timeoutId);
  }, [readyToDismiss]);

  return (
    <PathFindingProvider>
      <div id="app">
        <SidePanel />
        <PathFindingPanel />
        <div id="my-three">
          <MyThree />
        </div>
      </div>
      {!loadingScreenDismissed && (
        <div
          className={`loading-screen${needsLogin ? ' loading-screen--login' : ''}${readyToDismiss ? ' loading-screen--exiting' : ''}`}
          role={needsLogin ? undefined : 'status'}
          aria-live={needsLogin ? undefined : 'polite'}
        >
          <div className="loading-screen__visual">
            <div className="loading-screen__map" aria-hidden="true">
              <span className="loading-screen__route" />
              <span className="loading-screen__marker loading-screen__marker--start" />
              <span className="loading-screen__marker loading-screen__marker--end" />
            </div>
            <div className="loading-screen__content">
              <span className="loading-screen__eyebrow">Carte 3D et itinéraires</span>
              <h1>Cartographie de Mountyhall</h1>
              <p>Les lieux et les chemins prennent leur place.</p>
              <span className="loading-screen__progress" aria-hidden="true"><span /></span>
              <span className="loading-screen__label">Chargement des données</span>
            </div>
          </div>
          {needsLogin && <LoginDialog />}
        </div>
      )}
    </PathFindingProvider>
  )
}

export default App
